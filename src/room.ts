import { getConfig } from '@/config'
import { decryptMessageData } from '@/crypto'
import { db, getPinnedMessagesFromDb, getRoomAdminsAndModsFromDb, getRoomsFromDb } from '@/db'
import { BadPermission, PostRateLimited } from '@/errors'
import { requestPlugins } from '@/plugins'
import { type filesEntity, type message_detailsEntity, type messagesEntity, type room_moderatorsEntity, type roomsEntity, type user_permissionsEntity, type usersEntity } from '@/schema'
import { User } from '@/user'
import * as Utils from '@/utils'
import * as API from '@/api'

type PinnedMessage = {
  /** The numeric message id. */
  id: number
  /** The unix timestamp when the message was pinned. */
  pinnedAt: number
  /** The session ID of the admin who pinned this message (which is not necessarily the same as the
      author of the message). */
  pinnedBy: string
}

export type UserPermissions = { 
  read: boolean, 
  write: boolean, 
  upload: boolean, 
  banned: boolean,
  accessible: boolean,
  moderator: boolean,
  admin: boolean
}

export class Room {
  /** Unique identifier for database */
  id: number
  /** Unique human-readable token of room, e.g. `sudoku` */
  token: string
  /** Number of recently active users in the room over a recent time period (as
      given in the `active_users_cutoff` value).  Users are considered "active" if they have
      accessed the room (checking for new messages, etc.) at least once in the given period.
      **Note:** changes to this field do *not* update the room's `info_updates` value. */
  activeUsers: number
  /** The length of time (in seconds) of the `active_users` period.
      Defaults to a week (604800), but the open group administrator can configure it. */
  activeUsersCutoff: number
  /** File ID of an uploaded file containing the room's image.  Omitted if there is no
      image. */
  imageId: number | null
  /** The room name typically shown to users, e.g. `"Sodoku Solvers"`. **/
  name: string
  /** Text description of the room, e.g. `"All the best sodoku discussion!"`. */
  description: string | null
  /** Monotonic integer counter that increases whenever the room's metadata changes */
  infoUpdates: number
  /** Monotonic room post counter that increases each time a message is posted,
      edited, or deleted in this room.  (Note that changes to this field do *not* imply an update
      the room's `info_updates` value, nor vice versa). */
  messageSequence: number
  /** Unix timestamp (as a "inproper", according to pysogs developers, integer) of the room creation time.  Note that unlike python
      versions of SOGS, this is a better milliseconds-since-epoch unix timestamp, not a floating python-style
      seconds-since-epoch value. */
  created: number
  /** Array of pinned message information */
  pinnedMessages: PinnedMessage[]
  /** Room's publicly viewable moderators. This does not include room administrators nor hidden moderators. */
  moderators: Set<string>
  /** Room's publicly viewable administrators. This does not include room moderators nor hidden admins. */
  admins: Set<string>
  /** Room's publicly hidden moderators. */
  hiddenModerators: Set<string>
  /** Room's publicly hidden administrators. */
  hiddenAdmins: Set<string>
  /** Indicates whether new users have read permission in the room. */
  defaultRead: boolean
  /** Indicates whether new users have access permission in the room. */
  defaultAccessible: boolean
  /** Indicates whether new users have write permission in the room. */
  defaultWrite: boolean
  /** Indicates whether new users have upload permission in the room. */
  defaultUpload: boolean
  rateLimitSettings: {
    /** The number of messages a user can post in the rate limit interval before being rate limited. Set to 0 to disable rate limit */
    rateLimitSize: number
    /** The length of the rate limit interval in seconds. */
    rateLimitInterval: number
  }

  constructor(
    id: number,
    token: string,
    activeUsers: number,
    activeUsersCutoff: number,
    name: string,
    description: string | null,
    infoUpdates: number,
    messageSequence: number,
    created: number,
    pinnedMessages: PinnedMessage[],
    moderators: string[],
    admins: string[],
    defaultRead: boolean,
    defaultAccessible: boolean,
    defaultWrite: boolean,
    defaultUpload: boolean,
    imageId: number | null,
    hiddenModerators: string[],
    hiddenAdmins: string[],
    rateLimitSettings: {
      rateLimitSize: number
      rateLimitInterval: number
    }
  ) {
    this.id = id
    this.token = token
    this.activeUsers = activeUsers
    this.activeUsersCutoff = activeUsersCutoff
    this.name = name
    this.description = description
    this.infoUpdates = infoUpdates
    this.messageSequence = messageSequence
    this.created = created
    this.pinnedMessages = pinnedMessages
    this.moderators = new Set(moderators)
    this.admins = new Set(admins)
    this.defaultRead = defaultRead
    this.defaultAccessible = defaultAccessible
    this.defaultWrite = defaultWrite
    this.defaultUpload = defaultUpload
    this.imageId = imageId
    this.hiddenModerators = new Set(hiddenModerators)
    this.hiddenAdmins = new Set(hiddenAdmins)
    this.rateLimitSettings = rateLimitSettings
  }

  async getAdminsAndMods() {
    return await db.query<Pick<room_moderatorsEntity, 'session_id' | 'visible_mod' | 'admin'>, { $roomId: number }>(`
      SELECT session_id, visible_mod, admin FROM room_moderators
      WHERE room = $roomId
      ORDER BY session_id
    `).all({ $roomId: this.id })
  }

  async refresh() {
    const room = await db.query<roomsEntity, { $roomId: number }>('SELECT * FROM rooms WHERE id = $roomId')
      .get({ $roomId: this.id })
    if(room === null) {
      rooms.delete(this.token)
      return
    } else {
      this.defaultAccessible = room.accessible ? true : false
      this.defaultRead = room.read ? true : false
      this.defaultWrite = room.write ? true : false
      this.defaultUpload = room.upload ? true : false
      this.activeUsers = room.active_users
      this.description = room.description
      this.imageId = room.image
      this.rateLimitSettings = {
        rateLimitInterval: room.rate_limit_interval ?? 5,
        rateLimitSize: room.rate_limit_size ?? 16
      }
      this.infoUpdates = room.info_updates
    }
    const admins = new Set<string>(), 
      moderators = new Set<string>(), 
      hiddenAdmins = new Set<string>(), 
      hiddenModerators = new Set<string>()
    for(const row of await this.getAdminsAndMods()) {
      if(row.admin) {
        if(row.visible_mod) {
          admins.add(row.session_id)
        } else {
          hiddenAdmins.add(row.session_id)
        }
      } else {
        if(row.visible_mod) {
          moderators.add(row.session_id)
        } else {
          hiddenModerators.add(row.session_id)
        }
      }
    }
    this.admins = admins
    this.moderators = moderators
    this.hiddenAdmins = hiddenAdmins
    this.hiddenModerators = hiddenModerators
  }

  _permissionsCache: Map<number, { cachedAt: number, permissions: UserPermissions }> = new Map()
  async getUserPermissions(user: User): Promise<UserPermissions> {
    const roomId = this.id
    const permissionsCached = this._permissionsCache.get(user.id)
    if (permissionsCached !== undefined) {
      if (Date.now() - permissionsCached.cachedAt < 2000/*ms*/) {
        return permissionsCached.permissions
      } else {
        this._permissionsCache.delete(user.id)
      }
    }
    const permissionsDb = db.query<user_permissionsEntity, { $roomId: number, $user: number }>(`
      SELECT banned, read, accessible, write, upload, moderator, admin
      FROM user_permissions
      WHERE room = $roomId AND "user" = $user
    `).get({ $roomId: roomId, $user: user.id })
    const permissions = {
      banned: Boolean(permissionsDb?.banned),
      read: Boolean(permissionsDb?.read ?? this.defaultRead),
      accessible: Boolean(permissionsDb?.accessible ?? this.defaultAccessible),
      write: Boolean(permissionsDb?.write ?? this.defaultWrite),
      upload: Boolean(permissionsDb?.upload ?? this.defaultUpload),
      moderator: Boolean(permissionsDb?.moderator),
      admin: Boolean(permissionsDb?.admin)
    }
    this._permissionsCache.set(user.id, { cachedAt: Date.now(), permissions })
    return permissions
  }

  async isRegularMessage(messageId: number): Promise<boolean> {
    const row = await db.query<{ 'COUNT(*)': number }, { $messageId: number, $roomId: number }>(`
      SELECT COUNT(*) FROM messages
      WHERE room = $roomId AND id = $messageId AND data IS NOT NULL
          AND NOT filtered AND whisper IS NULL AND NOT whisper_mods
    `).get({ $roomId: this.id, $messageId: messageId })
    return row !== null && row['COUNT(*)'] > 0
  }

  /**
   * Returns reaction information for the given messages.  Returns a dict of message id ->
   * reaction info for any messages in the given list that have reactions.  The reaction info is
   * itself a dict where keys are reaction strings and values are a dict containing keys:
   * 
   * - `"count"` -- the total number of this reaction
   * - `"you"` -- boolean set to true if `user` is given and the user has applied this reaction;
   *   omitted otherwise.
   * - `"reactors"` -- if the input parameter `reactor_limit` is greater than 0 then this is a
   *   list of the session ids (if `session_ids`) or user ids (`session_ids` false) of the first
   *   `reactor_limit` users that applied this reaction.  Omitted if `reactor_limit` is 0.
   * 
   * This method does *not* check for read access of the given messages: this is designed for
   * internal use from message ids that have already been permission checked.
   */
  async getReactions(
    messageIds: number[], 
    user: User | null, 
    reactorLimit: number, 
    options?: { sessionIds?: true }
  ): Promise<{ [key: number]: { [key: string]: any } }> {
    if (messageIds.length === 0) {
      return {}
    }

    const reacts: { [key: number]: { [key: string]: { count: number, index: number, you?: boolean, reactors?: (number | string)[] } } } = {}
    const selectYou = user !== null
      ? 'EXISTS(SELECT * FROM user_reactions WHERE reaction = r.id AND "user" = $userId) AS you'
      : 'FALSE AS you'
    const messagesBind = Utils.bindSqliteArray(messageIds)

    const rows = await db.query<{ id: number, message: number, reaction: string, react_count: number, you: any }, { $userId?: number }>(`
      SELECT
        id,
        message,
        reaction,
        (SELECT COUNT(*) FROM user_reactions WHERE reaction = r.id) AS react_count,
        ${selectYou}
      FROM reactions r
      WHERE message IN (${messagesBind.k})
      ORDER BY id
    `).all({ 
      ...messagesBind.v,
      ...(user !== null && { $userId: user.id })
    })
    for (const row of rows) {
      const {
        id: reactid,
        message: msgid,
        reaction: react,
        react_count: count,
        you
      } = row
      reacts[msgid] ??= {}
      reacts[msgid][react] ??= { 
        count: count, 
        index: Object.keys(reacts[msgid]).length 
      }
      if (you) {
        reacts[msgid][react].you = true
      }
      const selectReactors = (
        options?.sessionIds
          ? `SELECT reaction, session_id
              FROM first_reactors JOIN users ON first_reactors."user" = users.id
            `
          : 'SELECT reaction, "user" FROM first_reactors '
      ) + 'WHERE reaction = $reactid AND _order <= $maxOrder ORDER BY at'
      const rows = await db.query<{ reaction: number } & ({ session_id: string } | { user: number }), { $reactid?: number, $maxOrder?: number }>(selectReactors)
        .all({
          $reactid: reactid,
          $maxOrder: reactorLimit
        })
      for (const row of rows) {
        reacts[msgid][react].reactors ??= []
        reacts[msgid][react].reactors!.push('user' in row ? row.user : row.session_id)
      }
    }

    return reacts
  }

  /**
    Adds a reaction to the given post.  Returns True if the reaction was added, False if the
    reaction by this user was already present, throws on other errors.

    SOGS requires that reactions be from 1 to 12 unicode characters long (throws InvalidData()
    if not satisfied).

    The post must exist in the room (throws NoSuchPost if it does not).

    The user must have read permission in the room (throws BadPermission if not).

    Returns a tuple of: bool indicating whether adding was successful (False = reaction already
    present), and the new message seqno value.
   */
  async addReaction({ user, messageId, reaction }: {
    user: User,
    messageId: number,
    reaction: string
  }) {
    if(!this.isRegularMessage(messageId)) {
      throw new Error('Invalid MessageId')
    }

    let added = false
    try {
      await db.query<null, { $messageId: number, $reaction: string, $user: number }>(`
        INSERT INTO message_reactions (message, reaction, "user")
        VALUES ($messageId, $reaction, $user)
      `).run({ $messageId: messageId, $reaction: reaction, $user: user.id })
      added = true
    } catch {false}
    const row = await db.query<{ seqno: number }, { $messageId: number }>(`
      SELECT seqno FROM messages WHERE id = $messageId
    `).get({ $messageId: messageId })
    if(row === null) {
      throw new Error('Failed to add reaction')
    }
    return { added, seqno: row.seqno }
  }

  async removeReaction({ user, messageId, reaction }: {
    user: User,
    messageId: number,
    reaction: string
  }) {
    let removed = false
    try {
      await db.query<null, { $messageId: number, $reaction: string, $userId: number }>(`
        DELETE FROM user_reactions
        WHERE reaction = (SELECT id FROM reactions WHERE message = $messageId AND reaction = $reaction)
          AND "user" = $userId
      `).run({ $messageId: messageId, $reaction: reaction, $userId: user.id })
      removed = true
    } catch {false}
    const row = await db.query<{ seqno: number }, { $messageId: number }>(`
      SELECT seqno FROM messages WHERE id = :msg
    `).get({ $messageId: messageId })
    if(row === null) {
      throw new Error('Failed to remove reaction')
    }
    return { seqno: row.seqno, removed }
  }

  async removeAllReactions({ messageId, reaction }: {
    messageId: number,
    reaction?: string
  }) {
    const results = await db.query<{ 'COUNT(*)': number }, { $messageId: number, $reaction?: string }>(`
      SELECT COUNT(*) FROM user_reactions WHERE
        reaction IN (SELECT id FROM reactions WHERE
            message = $messageId
            ${reaction ? 'AND reaction = $reaction' : ''})
    `).get({
      $messageId: messageId,
      ...(reaction && { $reaction: reaction })
    })
    await db.query<null, { $messageId: number, $reaction?: string }>(`
      DELETE FROM user_reactions WHERE
        reaction IN (SELECT id FROM reactions WHERE
            message = $messageId
            ${reaction ? 'AND reaction = $reaction' : ''})
    `).run({
      $messageId: messageId,
      ...(reaction && { $reaction: reaction })
    })
    const row = await db.query<{ seqno: number }, { $messageId: number }>(`
      SELECT seqno FROM messages WHERE id = $messageId
    `).get({ $messageId: messageId })
    if(row === null) {
      throw new Error('Failed to remove reaction')
    }
    return { seqno: row.seqno, removed: results?.['COUNT(*)'] ?? 0 }
  }

  async getReactors({ messageId, reaction, sessionIds, limit }: {
    messageId: number,
    reaction: string,
    sessionIds: boolean,
    limit?: number
  }) {
    const reactors = await db.query<({ session_id: string } | { user: number }) & { at: number }, { $messageId: number, $reaction: string }>(
      (sessionIds 
        ? 'SELECT session_id, at FROM message_reactions r JOIN users ON r.user = users.id'
        : 'SELECT "user", at FROM message_reactions r')
      + ' WHERE r.message = $messageId AND r.reaction = $reaction ORDER BY at'
      + (limit ? ' LIMIT $limit' : '')
    ).all({
      $messageId: messageId,
      $reaction: reaction,
      ...(limit && { $limit: limit })
    })
    return reactors.map(x => ['user' in x ? x.user : x.session_id, x.at])
  }

  /**
   * Returns up to `limit` message updates that `user` should see:
   * - all non-deleted new room messages
   * - newly edited messages
   * - newly deleted messages
   * - whispers directed to the user
   * - whispers directed to moderators (only applicable if the user is a moderator)
   * - reaction updates (if `reaction_updates` is true, and using `sequence`)
   *
   * Exactly one of `sequence`, `after`, `before`, `recent` or `single` must be specified:
   * - `sequence=N` returns updates made since the given `seqno` (that is: the have seqno greater
   *   than N).  Messages and reactions are returned in sequence order.
   * - `after=N` returns messages with ids greater than N in ascending order.  This is normally
   *   *not* what you want for fetching messages as it omits edits and deletions; typically you
   *   want to retrieve by seqno instead.
   * - `before=N` returns messages with ids less than N in descending order
   * - `recent=true` returns the most recent messages in descending order
   * - `single=123` returns a singleton list containing the single message with the given message
   *   id, or an empty list if the message doesn't exist or isn't readable by the user.
   *
   * Other parameters:
   * - `reactions` controls whether reaction details are added to retrieved messages.  Defaults
   *   to `true`.
   *
   * - `reaction_updates` controls whether the result returns reaction-only message update rows:
   *   these are objects with only the id/seqno/reaction properties (rather than the full message
   *   details) and are returned for messages that have had reactions changes since the requested
   *   sequence value but are not otherwise changed.  Such reaction-only updates are returned
   *   only when sequence polling (i.e.  using the `sequence` argument).
   *
   *   This field has no effect when `reactions` is false.
   *
   * - `reactor_limit` controls how many of the reactors array to return with reaction info; this
   *   is passed through to `getReactions`.  This field has no effect when `reactions` is false.
   *
   * Note that data and signature are returned as bytes, *not* base64 encoded.  Session message
   * padding *is* appended to the data field (i.e. this returns the full value, not the
   * padding-trimmed value actually stored in the database).
   */
  async getMessages(user: User | null, options:
    { sequence: number } | 
    { after: number } |
    { before: number } |
    { recent: boolean } |
    { single: number },
  { limit, reactorLimit, reactionsUpdates, reactions = true }: { 
    limit: number, 
    reactorLimit: number,
    reactionsUpdates?: boolean,
    reactions?: boolean
  }) {
    const mod = user === null 
      ? false
      : (
        this.moderators.has(user.sessionID)
        || this.admins.has(user.sessionID)
        || this.hiddenModerators.has(user.sessionID)
        || this.hiddenAdmins.has(user.sessionID)
        || user.admin
        || user.moderator
      )

    // We include deletions only if doing a sequence update request, but only include deletions
    // for messages that were created *before* the given sequence number (the client won't have
    // messages created after that, so it is pointless to send them tombstones for messages they
    // don't know about).
    const notDeletedClause = 'sequence' in options
      ? 'AND (data IS NOT NULL OR seqno_creation <= $sequence)'
      : 'AND data IS NOT NULL'
    const messageClause = 'sequence' in options && !reactionsUpdates
      ? 'AND seqno > $sequence AND seqno_data > $sequence'
      : 'sequence' in options
        ? 'AND seqno > $sequence'
        : 'after' in options
          ? 'AND id > $after'
          : 'before' in options
            ? 'AND id < $before'
            : 'single' in options
              ? 'AND id = $single'
              : ''

    const whisperClause =
      // For a mod we want to see:
      // - all whisper_mods messsages
      // - anything directed to us specifically
      // - anything we sent (i.e. outbound whispers)
      // - non-whispers
      mod
        ? 'AND (whisper_mods OR whisper = $user OR "user" = $user OR whisper IS NULL)'
        // For a regular user we want to see:
        // - anything with whisper_to sent to us
        // - non-whispers
        : user
          ? 'AND (whisper = $user OR (whisper IS NULL AND NOT whisper_mods))'
          // Otherwise for public, non-user access we want to see:
          // - non-whispers
          : 'AND whisper IS NULL AND NOT whisper_mods'

    const orderLimit = 'sequence' in options
      ? 'ORDER BY seqno ASC LIMIT $limit'
      : 'single' in options
        ? ''
        : 'after' in options 
          ? ''
          : 'ORDER BY id ASC LIMIT $limit'

    const rows = await db.query<message_detailsEntity, { $roomId: number, $sequence?: number, $after?: number, $before?: number, $single?: number, $user?: number, $limit: number }>(
      `SELECT * FROM message_details
      WHERE room = $roomId AND NOT filtered
      ${notDeletedClause}
      ${messageClause}
      ${whisperClause}
      ${orderLimit}`
    ).all({
      $roomId: this.id,
      ...('sequence' in options && { $sequence: options.sequence }),
      ...('after' in options && { $after: options.after }),
      ...('before' in options && { $before: options.before }),
      ...('single' in options && { $single: options.single }),
      ...(user && { $user: user.id }),
      $limit: limit
    })

    const msgs: any[] = []
    for(const row of rows) {
      if (
        'sequence' in options && 
        row.seqno_reactions !== null && 
        row.seqno_data !== null && 
        row.seqno_reactions > options.sequence && 
        options.sequence >= row.seqno_data
      ) {
        // This is a reaction-only update, so we only want to include the reaction info
        // (added later) but not the full details.
        msgs.push(['id', 'seqno'].reduce((acc: { [key: string]: any }, key) => {
          acc[key] = row[key as keyof message_detailsEntity]
          return acc
        }, {}))
        continue
      }

      const msg = ['id', 'session_id', 'posted', 'seqno'].reduce((acc: { [key: string]: any }, key) => {
        acc[key] = row[key as keyof message_detailsEntity]
        return acc
      }, {})

      const data = row['data']
      if (data === null) {
        msg['data'] = null
        msg['deleted'] = true
      } else {
        msg['data'] = Utils.addSessionMessagePadding(data, row['data_size'] as number)
        msg['signature'] = Buffer.from(row['signature'] as Uint8Array).toString('base64')
      }

      if (row['edited'] !== null) {
        msg['edited'] = row['edited']
      }

      if (row['whisper_to'] !== null || row['whisper_mods']) {
        msg['whisper'] = true
        msg['whisper_mods'] = row['whisper_mods']
        if (row['whisper_to'] !== null) {
          msg['whisper_to'] = row['whisper_to']
        }
      }

      msgs.push(msg)
    }

    if (reactions) {
      const reacts = await this.getReactions(
        // Fetch reactions for messages, but skip deleted messages (that have data set to an
        // explicit None) since we already know they don't have reactions.
        msgs.filter(x => !('data' in x) || x['data'] !== null)
          .map(x => x['id']),
        user,
        reactorLimit,
        { sessionIds: true },
      )
      for(const msg of msgs) {
        if(!('data' in msg) || msg['data'] !== null) {
          msg['reactions'] = reacts[msg['id']] ?? {}
        }
      }
    }

    return msgs
  }
  
  async _ownFiles({ msgId, files, userId }: {
    msgId: number,
    files: number[],
    userId: number
  }) {
    const bindedFiles = Utils.bindSqliteArray(files)
    await db.query<null, { $messageId: number, $expiry: number, $roomId: number, $recent: number, $userId: number }>(`
      UPDATE files SET
        message = $messageId,
        expiry = $expiry
      WHERE id IN (${bindedFiles.k})
        AND room = $roomId
        AND uploader = $userId
        AND message IS NULL
        AND uploaded >= $recent
        AND expiry IS NOT NULL
    `).run({
      $messageId: msgId,
      $expiry: Math.floor(Date.now() / 1000) + getConfig().expiry * 60 * 60 * 24,
      $recent: Math.floor(Date.now() / 1000) - 60 * 60,
      $roomId: this.id,
      $userId: userId,
      ...bindedFiles.v
    })
  }

  async updateUserActivity(user: User) {
    await db.query<never, { $user: number, $roomId: number, $now: number }>(`
      INSERT INTO room_users ("user", room) VALUES ($user, $roomId)
      ON CONFLICT("user", room) DO UPDATE
      SET last_active = $now
    `).run({ $user: user.id, $roomId: this.id, $now: Math.floor(Date.now() / 1000) })
  }

  /**
   * Adds a post (sendMessage) to the room.  The user must have write permissions.

   * Raises BadPermission if the user doesn't have posting permission; PostRejected if the
   * post was rejected (such as subclass PostRateLimited() if the post was rejected for too
   * frequent posting).

   * Returns the message details.
   */
  async addPost(
    user: User,
    data: Buffer,
    signature: Buffer,
    whisperTo: User | null,
    whisperMods?: boolean,
    files?: number[]
  ) {
    const permissions = await this.getUserPermissions(user)

    if (!permissions.write) {
      throw new BadPermission()
    }

    if ((whisperTo || whisperMods) && !permissions.moderator) {
      throw new BadPermission()
    }

    if(whisperTo === user) {
      whisperTo = null
    }

    const messageContent = decryptMessageData(data.toString('base64'))
    if (messageContent === null) {
      throw new Error('Failed to decrypt message')
    }
    const results = await requestPlugins('onBeforePost', { 
      message: {
        text: messageContent.dataMessage?.body ?? null,
        author: await API.mapUser(user, this),
        room: API.mapRoom(this)
      },
      server: API.mapSogs()
    })
    const filtered = results.filter(v => v !== undefined)
      .some(v => 'action' in v && v.action === 'reject')

    if(this.rateLimitSettings.rateLimitSize > 0 && !permissions.admin) {
      const sinceLimit = Date.now() - this.rateLimitSettings.rateLimitInterval * 1000
      const recentCount = db.prepare<{ 'COUNT(*)': number }, { $roomId: number, $user: number, $since: number }>(`
        SELECT COUNT(*) FROM messages
        WHERE room = $roomId AND "user" = $user AND posted >= $since
      `).get({ $roomId: this.id, $user: user.id, $since: sinceLimit })?.['COUNT(*)']

      if (recentCount !== undefined && recentCount >= this.rateLimitSettings.rateLimitSize) {
        throw new PostRateLimited()
      }
    }

    const dataSize = data.length
    const unpaddedData = Utils.removeSessionMessagePadding(data)

    const msgInsert = db.prepare<{ id: number }, { $roomId: number, $user: number, $data: Buffer, $dataSize: number, $signature: Buffer, $filtered: boolean, $whisper: number | null, $whisperMods: boolean | 0 }>(`
      INSERT INTO messages
        (room, "user", data, data_size, signature, filtered, whisper, whisper_mods)
        VALUES
        ($roomId, $user, $data, $dataSize, $signature, $filtered, $whisper, $whisperMods)
      RETURNING id
    `).get({
      $roomId: this.id,
      $user: user.id,
      $data: unpaddedData,
      $dataSize: dataSize,
      $signature: signature,
      $filtered: filtered,
      $whisper: whisperTo ? whisperTo.id : null,
      $whisperMods: whisperMods || 0
    })

    if(msgInsert === null) {
      throw new Error('Failed to insert message')
    }

    const msgId = msgInsert.id

    if (files?.length) {
      await this._ownFiles({ msgId, files, userId: user.id })
    }

    const row = db.prepare<{ posted: number, seqno: number }, { $msgId: number }>(
      'SELECT posted, seqno FROM messages WHERE id = $msgId'
    ).get({ $msgId: msgId })
    if(row === null) {
      throw new Error('Failed to fetch message')
    }

    this.messageSequence++

    const msg: { [k in keyof message_detailsEntity]?: any } & { reactions: Record<string, any> } = {
      id: msgId,
      session_id: user.sessionID,
      posted: row.posted,
      seqno: row.seqno,
      data: data.toString('base64'),
      signature: signature.toString('base64'),
      reactions: {},
      ...(filtered ? { filtered: true } : {}),
    }

    if(whisperTo || whisperMods) {
      msg['whisper'] = true
      msg['whisper_mods'] = whisperMods
      if(whisperTo) {
        msg['whisper_to'] = whisperTo
      }
    }

    return msg
  }

  /**
   * Deletes the messages with the given ids. The given user performing the delete must be a
   * moderator of the room.
   * Returns the ids actually deleted (that is, already-deleted and non-existent ids are not
   * returned).
   * Throws BadPermission (without deleting anything) if attempting to delete any posts that the
   * given user does not have permission to delete.
   */
  async deletePosts(
    user: User,
    ids: number[]
  ) {
    const permissions = await this.getUserPermissions(user)
    if(permissions.moderator || permissions.write) {
      const bindedIds = Utils.bindSqliteArray(ids)
      if (!permissions.moderator) {
        const checkForForeignMessages = await db.query<messagesEntity, { $user: number }>(`
          SELECT EXISTS(
            SELECT * FROM messages WHERE "user" != $user AND id IN (${bindedIds.k})
          )
        `).get({ $user: user.id, ...bindedIds.v })
        if (checkForForeignMessages && Boolean(Object.values(checkForForeignMessages)[0])) {
          throw new BadPermission()
        }
      }
      await db.query<null, Record<string, number>>(`DELETE FROM message_details WHERE id IN (${bindedIds.k})`)
        .run(bindedIds.v)
    } else {
      throw new BadPermission()
    }
  }

  async deleteAllFromUser(
    user: User
  ) {
    const ids = await db.query<Pick<message_detailsEntity, 'id'>, { $roomId: number, $user: number }>(`
      SELECT id FROM messages WHERE room = $roomId AND "user" = $user AND data IS NOT NULL
    `).all({ $roomId: this.id, $user: user.id })
    await db.query<Pick<message_detailsEntity, 'id'>, { $roomId: number, $user: number }>(`
      DELETE FROM message_details WHERE room = $roomId AND "user" = $user
    `).all({ $roomId: this.id, $user: user.id })
    await db.query<Pick<message_detailsEntity, 'id'>, { $roomId: number, $user: number }>(`
      UPDATE files SET expiry = 0.0 WHERE room = $roomId AND uploader = $user
    `).all({ $roomId: this.id, $user: user.id })
    return ids
  }

  async banUser({ user, timeout }: { user: User, timeout: number | undefined }) {
    await db.query<null, { $roomId: number, $userId: number }>(`
      INSERT INTO user_permission_overrides (room, "user", banned, moderator, admin)
          VALUES ($roomId, $userId, TRUE, FALSE, FALSE)
      ON CONFLICT (room, "user") DO
          UPDATE SET banned = TRUE, moderator = FALSE, admin = FALSE
    `).run({ $roomId: this.id, $userId: user.id })
    await db.query<null, { $roomId: number, $userId: number }>(`
      DELETE FROM user_ban_futures WHERE room = $roomId AND "user" = $userId
    `).run({ $roomId: this.id, $userId: user.id })
    if(timeout !== undefined) {
      await db.query<null, { $roomId: number, $userId: number, $at: number }>(`
        INSERT INTO user_ban_futures
        (room, "user", banned, at) VALUES ($roomId, $userId, FALSE, $at)
      `).run({ $roomId: this.id, $userId: user.id, $at: timeout })
    }
    this._permissionsCache.delete(user.id)
  }

  async unbanUser({ user }: { user: User }) {
    await db.query<null, { $roomId: number, $userId: number }>(`
      UPDATE user_permission_overrides SET banned = FALSE
      WHERE room = $roomId AND "user" = $userId AND banned
    `).run({ $roomId: this.id, $userId: user.id })
    this._permissionsCache.delete(user.id)
  }

  async setAdmin({ user, visible }: {
    user: User,
    visible: boolean
  }) {
    await db.query<null, { $roomId: number, $userId: number, $visible: boolean }>(`
      INSERT INTO user_permission_overrides
          (room,
          "user",
          moderator,
          admin,
          visible_mod)
      VALUES ($roomId, $userId, TRUE, TRUE, $visible)
      ON CONFLICT (room, "user") DO UPDATE SET
          moderator = excluded.moderator,
          admin = excluded.admin,
          visible_mod = excluded.visible_mod
    `).run({ $roomId: this.id, $userId: user.id, $visible: visible })
    this._permissionsCache.delete(user.id)
    await this.refresh()
  }

  async setModerator({ user, visible }: {
    user: User,
    visible: boolean
  }) {
    await db.query<null, { $roomId: number, $userId: number, $visible: boolean }>(`
      INSERT INTO user_permission_overrides
          (room,
          "user",
          moderator,
          visible_mod)
      VALUES ($roomId, $userId, TRUE, $visible)
      ON CONFLICT (room, "user") DO UPDATE SET
          moderator = excluded.moderator,
          visible_mod = excluded.visible_mod
    `).run({ $roomId: this.id, $userId: user.id, $visible: visible })
    this._permissionsCache.delete(user.id)
    await this.refresh()
  }

  async removeModerator({ user }: {
    user: User
  }) {
    await db.query<null, { $roomId: number, $userId: number }>(`
      UPDATE user_permission_overrides
      SET admin = FALSE, moderator = FALSE, visible_mod = TRUE
      WHERE room = $roomId AND "user" = $userId
    `).run({ $roomId: this.id, $userId: user.id })
    await this.refresh()
  }

  async removeAdmin({ user }: {
    user: User
  }) {
    await db.query<null, { $roomId: number, $userId: number }>(`
      UPDATE user_permission_overrides
      SET admin = FALSE
      WHERE room = $roomId AND "user" = $userId
    `).run({ $roomId: this.id, $userId: user.id })
    await this.refresh()
  }

  async pin({ messageId, pinnedBy }: {
    messageId: number
    pinnedBy: User
  }) {
    if(!this.isRegularMessage(messageId)) {
      throw new Error('Message not found')
    }
    await db.query<null, { $roomId: number, $messageId: number, $pinnedBy: number, $now: number }>(`
      INSERT INTO pinned_messages (room, message, pinned_by) VALUES ($roomId, $messageId, $pinnedBy)
      ON CONFLICT (room, message) DO UPDATE SET pinned_by = $pinnedBy, pinned_at = $now
    `).run({ $roomId: this.id, $messageId: messageId, $pinnedBy: pinnedBy.id, $now: Math.floor(Date.now() / 1000) })
    await this.refresh()
  }

  async unpin({ messageId }: {
    messageId: number
  }) {
    const files = await db.query<Pick<filesEntity, 'id'>, { $roomId: number, $messageId: number }>(`
      SELECT id FROM files WHERE room = $roomId AND message = $messageId
    `).all({ $roomId: this.id, $messageId: messageId })
    const filesBind = Utils.bindSqliteArray(files.map(x => x.id))
    await db.query<null, { $expiry: number }>(`
      UPDATE files SET expiry = uploaded + $expiry WHERE id IN (${filesBind.k})
    `).run({
      $expiry: getConfig().expiry * 60 * 60 * 24,
      ...filesBind.v,
    })
    await db.query<null, { $roomId: number, $messageId: number }>(`
      DELETE FROM pinned_messages WHERE room = $roomId AND message = $messageId
    `).run({ $roomId: this.id, $messageId: messageId })
    await this.refresh()
  }

  async unpinAll() {
    const files = await db.query<Pick<filesEntity, 'id'>, { $roomId: number }>(`
      SELECT id FROM files
      WHERE message IN (SELECT message FROM pinned_messages WHERE room = $roomId)
    `).all({ $roomId: this.id })
    const filesBind = Utils.bindSqliteArray(files.map(x => x.id))
    await db.query<null, { $expiry: number }>(`
      UPDATE files SET expiry = uploaded + $expiry WHERE id IN (${filesBind.k})
    `).run({
      $expiry: getConfig().expiry * 60 * 60 * 24,
      ...filesBind.v,
    })
    const results = await db.query<{ 'COUNT(*)': number }, { $roomId: number }>(`
      SELECT COUNT(*) FROM pinned_messages WHERE room = $roomId
    `).get({ $roomId: this.id })
    await db.query<null, { $roomId: number }>(`
      DELETE FROM pinned_messages WHERE room = $roomId
    `).run({ $roomId: this.id })
    await this.refresh()
    return results ? results['COUNT(*)'] : 0
  }
}

let rooms: Map<Room['token'], Room> = new Map()
export async function loadRooms() {
  const roomsDb = await getRoomsFromDb()
  rooms = new Map()
  
  for (const roomDb of roomsDb) {
    const room = await mapRoomEntityToRoomInstance(roomDb)
    rooms.set(roomDb.token, room)
  }

  return rooms
}

export function getRooms() {
  return rooms
}

export async function mapRoomEntityToRoomInstance(roomDb: roomsEntity) {
  const config = getConfig()
  const {
    admins,
    moderators,
    hiddenAdmins,
    hiddenModerators
  } = await getRoomAdminsAndModsFromDb(roomDb.id)
  const room = new Room(
    roomDb.id,
    roomDb.token,
    roomDb.active_users ?? 0,
    config.active_threshold * 24 * 60 * 60,
    roomDb.name,
    roomDb.description,
    roomDb.info_updates ?? 0,
    roomDb.message_sequence ?? 0,
    Math.floor(roomDb.created * 1000),
    await getPinnedMessagesFromDb(roomDb.id),
    moderators,
    admins,
    Boolean(roomDb.read),
    Boolean(roomDb.accessible),
    Boolean(roomDb.write),
    Boolean(roomDb.upload),
    roomDb.image,
    hiddenModerators,
    hiddenAdmins,
    {
      rateLimitSize: roomDb.rate_limit_size ?? 5,
      rateLimitInterval: roomDb.rate_limit_interval ?? 16.0
    }
  )
  await room.refresh()
  return room
}