import db from './db'
import tools from './lib/tools'
import DMclient from './dm_client_re'
import Options from './options'
import DanmuLib from './danmuLog'
import { EventEmitter } from 'events'
import { Options as requestOptions } from 'request'

/**
 * 监听房间消息
 *
 * @class RoomListener
 * @extends {EventEmitter}
 */
class RoomListener extends EventEmitter {
  constructor() {
    super()
  }
  /**
   * 监控房间
   *
   * @type {Map<number, DMclient>}
   * @memberof RoomListener
   */
  private roomList: Map<number, DMclient> = new Map()
  private liveRoomList: Map<number, DMclient> = new Map()
  private _DBRoomRefreshTimer!: NodeJS.Timer
  private _LiveRoomRefreshTimer!: NodeJS.Timer
  // 弹幕error计数
  private _DMErrorCount: number = 0
  // 弹幕error刷新计时器
  private _DMErrorTimer!: NodeJS.Timer
  /**
   * 开始监听
   *
   * @memberof RoomListener
   */
  public async Start() {
    const load = await db.roomList.load()
    if (load === null) {
      tools.Log('roomList was loaded')
      this._AddDBRoom()
      this._DBRoomRefreshTimer = setInterval(() => this._AddDBRoom(), 24 * 60 * 60 * 1000)
      if (Options._.config.globalListener) {
        this._AddLiveRoom()
        this._LiveRoomRefreshTimer = setInterval(() => this._AddLiveRoom(), 5 * 60 * 1000)
      }
      this._DMErrorTimer = setInterval(() => {
        if (this._DMErrorCount > 300) this._ResetRoom()
      }, 60 * 1000)
    }
    else tools.ErrorLog(load)
  }
  /**
   * 全站开播房间监听-刷新
   * 
   * @public
   */
  public async _RefreshLiveRoomListener() {
    if (Options._.config.globalListener) {
      this._AddLiveRoom()
      this._LiveRoomRefreshTimer = setInterval(() => this._AddLiveRoom(), 5 * 60 * 1000)
    }
    else {
      const len = this.liveRoomList.size
      this.liveRoomList.forEach(async (commentClient, roomID) => {
        commentClient
          .removeAllListeners()
          .Close()
        this.liveRoomList.delete(roomID)
      })
      tools.Log(`已断开与 ${len} 个开播房间的连接`)
    }
  }
  /**
   * 添加数据库内房间
   *
   * @private
   * @param {number} [date=Options._.config.dbTime * 24 * 60 * 60 * 1000]
   * @memberof RoomListener
   */
  public async _AddDBRoom(date = Options._.config.dbTime * 24 * 60 * 60 * 1000) {
    const roomList = await db.roomList.find<roomList>({ updateTime: { $gt: Date.now() - date } })
    if (roomList instanceof Error) tools.ErrorLog('读取数据库失败', roomList)
    else {
      const liveList: Set<number> = new Set()
      roomList.forEach(room => {
        liveList.add(room.roomID)
        this.AddRoom(room.roomID, room.masterID)
      })
      this.roomList.forEach(async (commentClient, roomID) => {
        if (liveList.has(roomID)) return
        commentClient
          .removeAllListeners()
          .Close()
        this.roomList.delete(roomID)
      })
      tools.Log(`已连接到数据库中的 ${roomList.length} 个房间`)
    }
  }
  /**
   * 添加已开播房间
   * 
   * @private
   * @memberof RoomListener
   */
  private async _AddLiveRoom() {
    const liveRoomInfo: requestOptions = {
      uri: `https://api.live.bilibili.com/room/v1/Area/getLiveRoomCountByAreaID?areaId=0`,
      json: true
    }
    const liveRooms = await tools.XHR<liveRooms>(liveRoomInfo)
    if (liveRooms === undefined || liveRooms.response.statusCode !== 200 || liveRooms.body.code !== 0) return
    const liveNumber = liveRooms.body.data.num
    let roomSet: Set<number> = new Set()
    for (let i = 1; i <= Math.ceil(liveNumber / 500); i++) {
      let allRoom = await tools.XHR<allRooms>({
        uri: `https://api.live.bilibili.com/room/v1/Area/getListByAreaID?page=${i}&pageSize=500`,
        json: true
      })
      if (allRoom === undefined || allRoom.body.code !== 0) continue
      else if (allRoom.response.statusCode !== 200) return tools.Log(allRoom.response.statusCode)
      let allRoomData = allRoom.body.data
      allRoomData.forEach(room => {
        if (this.roomList.has(room.roomid)) return
        roomSet.add(room.roomid)
        this.AddLiveRoom(room.roomid, room.uid)
      })
      await tools.Sleep(3 * 1000)
    }
    this.liveRoomList.forEach(async (commentClient, roomID) => {
      if (roomSet.has(roomID)) return
      commentClient
        .removeAllListeners()
        .Close()
      this.liveRoomList.delete(roomID)
    })
    tools.Log(`已连接到 ${liveNumber} 个开播房间`)
  }
  /**
   * 重设监听
   *
   * @memberof RoomListener
   */
  private async _ResetRoom() {
    this._DMErrorCount = 0
    clearInterval(this._DMErrorTimer)
    clearInterval(this._DBRoomRefreshTimer)
    clearInterval(this._LiveRoomRefreshTimer)
    this.roomList.forEach(async (commentClient, roomID) => {
      commentClient
        .removeAllListeners()
        .Close()
      this.roomList.delete(roomID)
    })
    this.liveRoomList.forEach(async (commentClient, roomID) => {
      commentClient
        .removeAllListeners()
        .Close()
      this.liveRoomList.delete(roomID)
    })
    await this.Start()
  }
  /**
   * 添加直播房间
   *
   * @param {number} roomID
   * @param {number} [userID=0]
   * @memberof RoomListener
   */
  public async AddRoom(roomID: number, userID: number = 0) {
    if (this.roomList.has(roomID)) return
    if (userID === 0) userID = await this._getMasterID(roomID)
    const commentClient = new DMclient({ roomID, userID, protocol: 'flash' })
    commentClient
      .on('SYS_MSG', dataJson => this.emit('SYS_MSG', dataJson))
      .on('SYS_GIFT', dataJson => this.emit('SYS_GIFT', dataJson))
      .on('TV_START', dataJson => this._RaffleStartHandler(dataJson))
      .on('RAFFLE_START', dataJson => this._RaffleStartHandler(dataJson))
      .on('LOTTERY_START', dataJson => this._LotteryStartHandler(dataJson))
      .on('PK_LOTTERY_START', dataJson => this._PKLotteryStartHandler(dataJson))
      .on('GUARD_LOTTERY_START', dataJson => this._LotteryStartHandler(dataJson))
      .on('SPECIAL_GIFT', dataJson => this._SpecialGiftHandler(dataJson))
      .on('ALL_MSG', dataJson => {
        if (!Options._.config.excludeCMD.includes(dataJson.cmd)) {
          Options._.config.excludeCMD.push(dataJson.cmd)
          tools.Log(JSON.stringify(dataJson))
        }
        DanmuLib.add(dataJson)
      })
      .on('DMerror', () => this._DMErrorCount++)
      .Connect({ server: 'broadcastlv.chat.bilibili.com', port: 2243 })
    this.roomList.set(roomID, commentClient)
  }
  /**
   * 添加直播房间2
   *
   * @param {number} roomID
   * @param {number} userID
   * @memberof RoomListener
   */
  public async AddLiveRoom(roomID: number, userID: number = 0) {
    if (this.liveRoomList.has(roomID)) return
    if (userID === 0) userID = await this._getMasterID(roomID)
    const commentClient = new DMclient({ roomID, userID, protocol: 'flash' })
    commentClient
      .on('SYS_MSG', dataJson => this.emit('SYS_MSG', dataJson))
      .on('SYS_GIFT', dataJson => this.emit('SYS_GIFT', dataJson))
      .on('TV_START', dataJson => this._RaffleStartHandler(dataJson))
      .on('RAFFLE_START', dataJson => this._RaffleStartHandler(dataJson))
      .on('LOTTERY_START', dataJson => this._LotteryStartHandler(dataJson, '2'))
      .on('PK_LOTTERY_START', dataJson => this._PKLotteryStartHandler(dataJson, '2'))
      .on('GUARD_LOTTERY_START', dataJson => this._LotteryStartHandler(dataJson, '2'))
      .on('SPECIAL_GIFT', dataJson => this._SpecialGiftHandler(dataJson, '2'))
      .on('ALL_MSG', dataJson => {
        if (!Options._.config.excludeCMD.includes(dataJson.cmd)) {
          Options._.config.excludeCMD.push(dataJson.cmd)
          tools.Log(JSON.stringify(dataJson))
        }
        DanmuLib.add(dataJson)
      })
      .on('DMerror', () => this._DMErrorCount++)
      .Connect({ server: 'broadcastlv.chat.bilibili.com', port: 2243 })
    this.liveRoomList.set(roomID, commentClient)
  }
  /**
   * 返回房间数
   *
   * @memberof RoomListener
   */
  public roomListSize() {
    return (this.roomList.size + this.liveRoomList.size)
  }
  /**
   * 监听抽奖
   *
   * @private
   * @param {RAFFLE_START} dataJson
   * @memberof RoomListener
   */
  private _RaffleStartHandler(dataJson: RAFFLE_START) {
    if (dataJson.data === undefined || dataJson.data.raffleId === undefined) return
    const cmd = 'raffle'
    const raffleMessage: raffleMessage = {
      cmd,
      roomID: dataJson._roomid,
      id: +dataJson.data.raffleId,
      type: dataJson.data.type,
      title: dataJson.data.title,
      time: +dataJson.data.time,
      max_time: +dataJson.data.max_time,
      time_wait: +dataJson.data.time_wait
    }
    this.emit(cmd, raffleMessage)
  }
  /**
   * 监听快速抽奖
   *
   * @private
   * @param {LOTTERY_START} dataJson
   * @param {null | 2} source
   * @memberof RoomListener
   */
  private _LotteryStartHandler(dataJson: LOTTERY_START, source: '' | '2' = '') {
    if (dataJson.data === undefined || dataJson.data.id === undefined) return
    const lotteryMessage: lotteryMessage = {
      cmd: 'lottery',
      roomID: dataJson._roomid,
      id: +dataJson.data.id,
      type: dataJson.data.type,
      title: '舰队抽奖',
      time: +dataJson.data.lottery.time
    }
    this.emit(`lottery${source}`, lotteryMessage)
  }
  /**
   * 监听大乱斗抽奖
   *
   * @private
   * @param {PK_LOTTERY_START} dataJson
   * @param {null | 2} source
   * @memberof RoomListener
   */
  private _PKLotteryStartHandler(dataJson: PK_LOTTERY_START, source: '' | '2' = '') {
    if (dataJson.data === undefined || dataJson.data.id === undefined) return
    const raffleMessage: lotteryMessage = {
      cmd: 'pklottery',
      roomID: dataJson._roomid,
      id: +dataJson.data.id,
      type: 'pk',
      title: dataJson.data.title,
      time: +dataJson.data.time
    }
    this.emit(`pklottery${source}`, raffleMessage)
  }
  /**
   * 监听特殊礼物消息
   *
   * @private
   * @param {SPECIAL_GIFT} dataJson
   * @param {'' | '2'} source
   * @memberof RoomListener
   */
  private _SpecialGiftHandler(dataJson: SPECIAL_GIFT, source: '' | '2' = '') {
    if (dataJson.data['39'] !== undefined && dataJson.data['39'].action === 'start') this._BeatStormHandler(dataJson, source)
  }
  /**
   * 监听节奏风暴消息
   *
   * @private
   * @param {SPECIAL_GIFT} dataJson
   * @param {'' | '2'} source
   * @memberof RoomListener
   */
  private _BeatStormHandler(dataJson: SPECIAL_GIFT, source: '' | '2' = '') {
    const beatStormData = <SPECIAL_GIFT_data_beatStorm_start>dataJson.data['39']
    const beatStormMessage: beatStormMessage = {
      cmd: 'beatStorm',
      roomID: dataJson._roomid,
      num: +beatStormData.num,
      id: +beatStormData.id,
      type: 'beatStorm',
      title: '节奏风暴',
      time: Date.now()
    }
    this.emit(`beatStorm${source}`, beatStormMessage)
  }
  /**
   * 写入数据库
   *
   * @param {number} roomID
   * @param {string} cmd
   * @memberof RoomListener
   */
  public async UpdateDB(roomID: number, cmd: string) {
    const $inc: { [index: string]: number } = {}
    $inc[cmd] = 1
    const roomInfo = await db.roomList.findOne<roomList>({ roomID })
    let $set
    if (!(roomInfo instanceof Error) && (roomInfo === null || roomInfo.masterID === 0)) {
      const masterID = await this._getMasterID(roomID)
      $set = { masterID, updateTime: Date.now() }
    }
    if ($set === undefined) $set = { updateTime: Date.now() }
    const update = await db.roomList.update({ roomID }, { $inc, $set }, { upsert: true })
    if (update instanceof Error) tools.ErrorLog('更新数据库失败', update)
  }
  /**
   * 获取masterID
   *
   * @private
   * @param {number} roomID
   * @returns {Promise<number>}
   * @memberof RoomListener
   */
  private async _getMasterID(roomID: number): Promise<number> {
    const getRoomInit: requestOptions = {
      uri: `${Options._.config.apiLiveOrigin}/room/v1/Room/mobileRoomInit?id=${roomID}}`,
      json: true
    }
    const roomInit = await tools.XHR<roomInit>(getRoomInit, 'Android')
    if (roomInit !== undefined && roomInit.response.statusCode === 200)
      return roomInit.body.data.uid
    return 0
  }
}
interface liveRooms {
  code: number
  data: liveRoomNum
  message: string
  msg: string
}
interface liveRoomNum {
  num: number
}
interface allRooms {
  code: number
  data: allRoomsData[]
  message: string
  msg: string
}
interface allRoomsData {
  uid: number
  roomid: number 
}

export default RoomListener
