import { getConfig } from '@/config'
import { db, getPinnedMessagesFromDb, getRoomAdminsAndModsFromDb, getRoomsFromDb } from '@/db'
import { isUserGlobalAdmin, isUserGlobalModerator } from '@/global-settings'
import type { message_detailsEntity, user_permissionsEntity } from '@/schema'
import * as Utils from '@/utils'

type PinnedMessage = {
  /** The numeric message id. */
  id: number
  /** The unix timestamp when the message was pinned. */
  pinnedAt: number
  /** The session ID of the admin who pinned this message (which is not necessarily the same as the
      author of the message). */
  pinnedBy: string
}

export type UserPermissions = { read: boolean, write: boolean, upload: boolean, banned: boolean }

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
  /** Array of Session IDs of the room's publicly viewable moderators. This does not include room administrators nor hidden moderators. */
  moderators: string[]
  /** Array of Session IDs of the room's publicly viewable administrators. This does not include room moderators nor hidden admins. */
  admins: string[]
  /** Array of Session IDs of the room's publicly hidden moderators. */
  hiddenModerators: string[]
  /** Array of Session IDs of the room's publicly hidden administrators. */
  hiddenAdmins: string[]
  /** Indicates whether new users have read permission in the room. */
  defaultRead: boolean
  /** Indicates whether new users have access permission in the room. */
  defaultAccessible: boolean
  /** Indicates whether new users have write permission in the room. */
  defaultWrite: boolean
  /** Indicates whether new users have upload permission in the room. */
  defaultUpload: boolean

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
    hiddenAdmins: string[]
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
    this.moderators = moderators
    this.admins = admins
    this.defaultRead = defaultRead
    this.defaultAccessible = defaultAccessible
    this.defaultWrite = defaultWrite
    this.defaultUpload = defaultUpload
    this.imageId = imageId
    this.hiddenModerators = hiddenModerators
    this.hiddenAdmins = hiddenAdmins
  }

  _permissionsCache: Map<string, UserPermissions> = new Map()
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    const permissionsCached = this._permissionsCache.get(userId)
    if (permissionsCached !== undefined) {
      return permissionsCached
    }

    const roomId = this.id
    const permissionsDb = db.query<user_permissionsEntity, { $roomId: number, $user: string }>(`
      SELECT banned, read, accessible, write, upload, moderator, admin
      FROM user_permissions
      WHERE room = $roomId AND "user" = $user
    `).get({ $roomId: roomId, $user: userId })
    const permissions = {
      read: permissionsDb?.read ?? this.defaultRead,
      write: permissionsDb?.write ?? this.defaultWrite,
      upload: permissionsDb?.upload ?? this.defaultUpload,
      banned: permissionsDb?.banned ?? false
    }
    this._permissionsCache.set(userId, permissions)
    return permissions
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
    user: string | null, 
    reactorLimit: number, 
    options?: { sessionIds?: true }
  ): Promise<Map<number, { [key: string]: any }>> {
    return new Map()
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
  async getMessages(user: string | null, options:
    { sequence: number } | 
    { after: number } |
    { before: number } |
    { recent: boolean } |
    { single: number },
  { limit, reactorLimit }: { limit: number, reactorLimit: number }
  ) {
    const mod = user === null 
      ? false
      : (
        this.moderators.includes(user)
        || this.admins.includes(user)
        || this.hiddenModerators.includes(user)
        || this.hiddenAdmins.includes(user)
        || isUserGlobalAdmin(user)
        || isUserGlobalModerator(user)
      )

    // We include deletions only if doing a sequence update request, but only include deletions
    // for messages that were created *before* the given sequence number (the client won't have
    // messages created after that, so it is pointless to send them tombstones for messages they
    // don't know about).
    const notDeletedClause = 'sequence' in options
      ? 'AND (data IS NOT NULL OR seqno_creation <= $sequence)'
      : 'AND data IS NOT NULL'
    const messageClause = 'sequence' in options && !('reaction_updates' in options)
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

    const rows = await db.query<message_detailsEntity, { $roomId: number, $sequence?: number, $after?: number, $before?: number, $single?: number, $user: string | null, $limit: number }>(
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
      $user: user,
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

    if ('reactions' in options) {
      const reacts = await this.getReactions(
        // Fetch reactions for messages, but skip deleted messages (that have data set to an
        // explicit None) since we already know they don't have reactions.
        msgs.filter(x => 'data' in x && x['data'] !== null)
          .map(x => x['id']),
        user,
        reactorLimit,
        { sessionIds: true },
      )
      for(const msg of msgs) {
        if(!('data' in msg) || msg['data']) {
          msg['reactions'] = reacts.get(msg['id']) ?? {}
        }
      }
    }

    return msgs
  }

  async updateUserActivity(user: string) {
    await db.query<never, { $user: string, $roomId: number, $now: number }>(`
      INSERT INTO room_users ("user", room) VALUES ($user, $roomId)
      ON CONFLICT("user", room) DO UPDATE
      SET last_active = $now
    `).run({ $user: user, $roomId: this.id, $now: Math.floor(Date.now() / 1000) })
  }
}

let rooms: Map<Room['token'], Room> = new Map()
export async function loadRooms() {
  const config = getConfig()
  const roomsDb = await getRoomsFromDb()

  rooms = new Map()
  
  for (const roomDb of roomsDb) {
    const { 
      admins, 
      moderators, 
      hiddenAdmins,
      hiddenModerators 
    } = await getRoomAdminsAndModsFromDb(roomDb.id)
    rooms.set(roomDb.token, new Room(
      roomDb.id,
      roomDb.token,
      roomDb.active_users ?? 0,
      config.active_threshold*24*60*60,
      roomDb.name,
      roomDb.description,
      roomDb.info_updates ?? 0,
      roomDb.message_sequence ?? 0,
      Math.floor(roomDb.created * 1000),
      await getPinnedMessagesFromDb(roomDb.id),
      moderators,
      admins,
      roomDb.read,
      roomDb.accessible,
      roomDb.write,
      roomDb.upload,
      roomDb.image,
      hiddenModerators,
      hiddenAdmins
    ))
  }

  return rooms
}

export function getRooms() {
  return rooms
}