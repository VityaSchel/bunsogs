import { getConfig } from '@/config'
import { getPinnedMessagesFromDb, getRoomAdminsAndModsFromDb, getRoomsFromDb } from '@/db'

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
  /** Array of pinned message information (omitted entirely if there are no
      pinned messages). */
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