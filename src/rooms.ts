import { getRooms } from '@/db'

type PinnedMessage = {
  /** The numeric message id. */
  id: number
  /** The unix timestamp when the message was pinned. */
  pinnedAt: number
  /** The session ID of the admin who pinned this message (which is not necessarily the same as the
      author of the message). */
  pinnedBy: string
}

export class Room {
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
  imageId?: number
  /** The room name typically shown to users, e.g. `"Sodoku Solvers"`. **/
  name: string
  /** Text description of the room, e.g. `"All the best sodoku discussion!"`. */
  description: string
  /** Monotonic integer counter that increases whenever the room's metadata changes */
  infoUpdates: number
  /** Monotonic room post counter that increases each time a message is posted,
      edited, or deleted in this room.  (Note that changes to this field do *not* imply an update
      the room's `info_updates` value, nor vice versa). */
  messageSequence: number
  /** Unix timestamp (as a float) of the room creation time.  Note that unlike earlier
      versions of SOGS, this is a proper seconds-since-epoch unix timestamp, not a javascript-style
      millisecond value. */
  created: number
  /** Array of pinned message information (omitted entirely if there are no
      pinned messages). */
  pinnedMessages: PinnedMessage[]
  /** Array of Session IDs of the room's publicly viewable moderators. This does not include room administrators nor hidden moderators. */
  moderators: string[]
  /** Array of Session IDs of the room's publicly viewable administrators. This does not include room moderators nor hidden admins. */
  admins: string[]
  /** Array of Session IDs of the room's publicly hidden moderators. */
  hiddenModerators?: string[]
  /** Array of Session IDs of the room's publicly hidden administrators. */
  hiddenAdmins?: string[]
  /** Indicates whether new users have read permission in the room. */
  defaultRead: boolean
  /** Indicates whether new users have access permission in the room. */
  defaultAccessible: boolean
  /** Indicates whether new users have write permission in the room. */
  defaultWrite: boolean
  /** Indicates whether new users have upload permission in the room. */
  defaultUpload: boolean

  constructor(
    activeUsers: number,
    activeUsersCutoff: number,
    name: string,
    description: string,
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
    imageId?: number,
    hiddenModerators?: string[],
    hiddenAdmins?: string[]
  ) {
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


}

export async function loadRooms() {
  console.log(await getRooms())
}