import { Options as requestOptions } from 'request'
import { EventEmitter } from 'events'
import tools from './lib/tools'
import AppClient from './lib/app_client'
import DMclient from './dm_client_re'
import RoomListener from './roomlistener'
import Options from './options'
/**
 * 监听服务器消息
 *
 * @class Listener
 * @extends {EventEmitter}
 */
class Listener extends EventEmitter {
  constructor() {
    super()
  }
  /**
   * 多分区监听，用于接收弹幕消息
   *
   * @private
   * @type {Map<number, DMclient>}
   * @memberof Listener
   */
  private _DMclient: Map<number, DMclient> = new Map()
  /**
   * 小电视ID
   *
   * @private
   * @type {Set<number>}
   * @memberof Listener
   */
  private _smallTVID: Set<number> = new Set()
  private _dailySmallTVID: Set<number> = new Set()
  /**
   * 抽奖ID
   *
   * @private
   * @type {Set<number>}
   * @memberof Listener
   */
  private _raffleID: Set<number> = new Set()
  private _dailyRaffleID: Set<number> = new Set()
  /**
   * 快速抽奖ID
   *
   * @private
   * @type {Set<number>}
   * @memberof Listener
   */
  private _lotteryID: Set<number> = new Set()
  private _dailyLotteryID: Set<number> = new Set()
  /**
   * 节奏风暴ID
   *
   * @private
   * @type {Set<number>}
   * @memberof Listener
   */
  private _beatStormID: Set<number> = new Set()
  private _dailyBeatStormID: Set<number> = new Set()
  /**
   * 消息缓存
   *
   * @private
   * @type {Set<string>}
   * @memberof Listener
   */
  private _MSGCache: Set<string> = new Set()
  /**
   * 房间监听
   *
   * @private
   * @type {RoomListener}
   * @memberof Listener
   */
  private _RoomListener!: RoomListener
  /**
   * 开始监听时间
   *
   * @private
   * @type {number}
   * @memberof Listener
   */
  private _ListenStartTime: number = Date.now()
  // 全局计时器
  private _lastTime = ''
  public loop!: NodeJS.Timer
  /**
   * 开始监听
   *
   * @memberof Listener
   */
  public Start() {
    this.updateAreaRoom()
    setInterval(() => this.updateAreaRoom(), 5 * 60 * 1000)
    this._RoomListener = new RoomListener()
    this._RoomListener
      .on('smallTV', (raffleMessage: raffleMessage) => this._RaffleHandler(raffleMessage))
      .on('raffle', (raffleMessage: raffleMessage) => this._RaffleHandler(raffleMessage))
      .on('lottery', (lotteryMessage: lotteryMessage) => this._RaffleHandler(lotteryMessage))
      .on('beatStorm', (beatStormMessage: beatStormMessage) => this._RaffleHandler(beatStormMessage))
      .on('box', (boxMessage: boxMessage) => this._RaffleHandler(boxMessage))
      .on('lottery2', (lotteryMessage: lotteryMessage) => this._RaffleHandler2(lotteryMessage))
      .on('beatStorm2', (beatStormMessage: beatStormMessage) => this._RaffleHandler2(beatStormMessage))
      .Start()
    Options.on('dbTimeUpdate', () => this._RoomListener._AddDBRoom())
    Options.on('globalFlagUpdate', () => this._RoomListener._RefreshLiveRoomListener())
    this.loop = setInterval(() => this._loop(), 55 * 1000)
  }
  /**
   * 计时器
   *
   * @private
   * @memberof BiLive
   */
  private _loop() {
    const csttime = Date.now() + 8 * 60 * 60 * 1000
    const cst = new Date(csttime)
    const cstString = cst.toUTCString().substr(17, 5) // 'HH:mm'
    if (cstString === this._lastTime) return
    this._lastTime = cstString
    const cstHour = cst.getUTCHours()
    const cstMin = cst.getUTCMinutes()
    if (cstMin === 59) this.logAllID(cstHour + 1)
    if (cstString === '00:00') this.clearAllID()
  }
  /**
   * 清空每日ID缓存
   *
   * @memberof Listener
   */
  private clearAllID() {
    this._dailyBeatStormID.clear()
    this._dailySmallTVID.clear()
    this._dailyRaffleID.clear()
    this._dailyLotteryID.clear()
  }
  /**
   * 计算遗漏数量
   *
   * @param {Set<number>, Set<number>} 
   * @memberof Listener
   */
  private getMisses(Set1: Set<number>, Set2: Set<number>) {
    let query1 = [...Set1]
    let query2 = [...Set2]
    if (query2.length > 0 && query2[0].toString().length > 6) { // For beatStorm IDs
      for (let i = 0; i < query2.length; i++) query2[i] = Number(query2[i].toString().slice(0, -6))
    }
    let query = query1.concat(query2).sort(function(a, b){return a - b})
    let Start: number = 0
    let End: number = 0
    if (query.length > 0) {
      Start = query[0]
      End = query[query.length-1]
    }
    let Misses = End - Start + 1 - query.length
    if (query.length === 0) Misses -= 1
    return Misses
  }
  /**
   * 监听数据Log
   * 
   * @param {number}
   * @memberof Listener
   */
  private async logAllID(int: number) {
    let raffleMisses = this.getMisses(this._smallTVID, this._raffleID)
    let lotteryMisses = this.getMisses(this._lotteryID, this._beatStormID)
    let dailyRaffleMisses = this.getMisses(this._dailySmallTVID, this._dailyRaffleID)
    let dailyLotteryMisses = this.getMisses(this._dailyLotteryID, this._dailyBeatStormID)
    let logMsg: string = '\n'
    logMsg += `/********************************* bilive_server 运行信息 *********************************/\n`
    logMsg += `本次监听开始于：${new Date(this._ListenStartTime).toString()}\n`
    logMsg += `共监听到小电视抽奖数：${this._smallTVID.size}(${this._dailySmallTVID.size})\n`
    logMsg += `共监听到活动抽奖数：${this._raffleID.size}(${this._dailyRaffleID.size})\n`
    logMsg += `共监听到大航海抽奖数：${this._lotteryID.size}(${this._dailyLotteryID.size})\n`
    logMsg += `共监听到节奏风暴抽奖数：${this._beatStormID.size}(${this._dailyBeatStormID.size})\n`
    logMsg += `raffle漏监听：${raffleMisses}(${(raffleMisses/(raffleMisses+this._smallTVID.size+this._raffleID.size)*100).toFixed(1)}%)\n`
    logMsg += `lottery漏监听：${lotteryMisses}(${(lotteryMisses/(lotteryMisses+this._lotteryID.size+this._beatStormID.size)*100).toFixed(1)}%)\n`
    logMsg += `今日raffle漏监听：${dailyRaffleMisses}(${(dailyRaffleMisses/(dailyRaffleMisses+this._dailySmallTVID.size+this._dailyRaffleID.size)*100).toFixed(1)}%)\n`
    logMsg += `今日lottery漏监听：${dailyLotteryMisses}(${(dailyLotteryMisses/(dailyLotteryMisses+this._dailyLotteryID.size+this._dailyBeatStormID.size)*100).toFixed(1)}%)\n`
    tools.Log(logMsg)
    let pushMsg: string = ''
    pushMsg += `# bilive_server 监听情况报告\n`
    pushMsg += `- 本次监听开始于：${new Date(this._ListenStartTime).toString()}\n`
    pushMsg += `- 共监听到小电视抽奖数：${this._smallTVID.size}(${this._dailySmallTVID.size})\n`
    pushMsg += `- 共监听到活动抽奖数：${this._raffleID.size}(${this._dailyRaffleID.size})\n`
    pushMsg += `- 共监听到大航海抽奖数：${this._lotteryID.size}(${this._dailyLotteryID.size})\n`
    pushMsg += `- 共监听到节奏风暴抽奖数：${this._beatStormID.size}(${this._dailyBeatStormID.size})\n`
    pushMsg += `- raffle漏监听：${raffleMisses}(${(raffleMisses/(raffleMisses+this._smallTVID.size+this._raffleID.size)*100).toFixed(1)}%)\n`
    pushMsg += `- lottery漏监听：${lotteryMisses}(${(lotteryMisses/(lotteryMisses+this._lotteryID.size+this._beatStormID.size)*100).toFixed(1)}%)\n`
    pushMsg += `- 今日raffle漏监听：${dailyRaffleMisses}(${(dailyRaffleMisses/(dailyRaffleMisses+this._dailySmallTVID.size+this._dailyRaffleID.size)*100).toFixed(1)}%)\n`
    pushMsg += `- 今日lottery漏监听：${dailyLotteryMisses}(${(dailyLotteryMisses/(dailyLotteryMisses+this._dailyLotteryID.size+this._dailyBeatStormID.size)*100).toFixed(1)}%)\n`
    if (int % 8 === 0) tools.sendSCMSG(pushMsg)
  }
  /**
   * 更新分区房间
   *
   * @memberof Listener
   */
  public async updateAreaRoom() {
    // 获取直播列表
    const getAllList = await tools.XHR<getAllList>({
      uri: `${Options._.config.apiLiveOrigin}/room/v2/AppIndex/getAllList?${AppClient.baseQuery}`,
      json: true
    }, 'Android')
    if (getAllList !== undefined && getAllList.response.statusCode === 200 && getAllList.body.code === 0) {
      const roomIDs: Set<number> = new Set()
      // 获取房间列表
      getAllList.body.data.module_list.forEach(modules => {
        if (modules.module_info.type === 9 && modules.list.length > 2) {
          for (let i = 0; i < modules.list.length; i++) roomIDs.add((<getAllListDataRoomList>modules.list[i]).roomid)
        }
      })
      // 添加房间
      roomIDs.forEach(roomID => {
        if (this._DMclient.has(roomID)) return
        const newDMclient = new DMclient({ roomID })
        newDMclient
          .on('SYS_MSG', dataJson => this._SYSMSGHandler(dataJson))
          .on('SYS_GIFT', dataJson => this._SYSGiftHandler(dataJson))
          .Connect()
        this._DMclient.set(roomID, newDMclient)
      })
      // 移除房间
      this._DMclient.forEach((roomDM, roomID) => {
        if (roomIDs.has(roomID)) return
        roomDM.removeAllListeners().Close()
        this._DMclient.delete(roomID)
      })
    }
  }
  /**
   * 监听弹幕系统消息
   *
   * @private
   * @param {SYS_MSG} dataJson
   * @memberof Listener
   */
  private _SYSMSGHandler(dataJson: SYS_MSG) {
    if (dataJson.real_roomid === undefined || this._MSGCache.has(dataJson.msg_text)) return
    this._MSGCache.add(dataJson.msg_text)
    const url = Options._.config.apiLiveOrigin + Options._.config.smallTVPathname
    const roomID = +dataJson.real_roomid
    this._RaffleCheck(url, roomID)
  }
  /**
   * 监听系统礼物消息
   *
   * @private
   * @param {SYS_GIFT} dataJson
   * @memberof Listener
   */
  private _SYSGiftHandler(dataJson: SYS_GIFT) {
    if (dataJson.real_roomid === undefined || this._MSGCache.has(dataJson.msg_text)) return
    this._MSGCache.add(dataJson.msg_text)
    const url = Options._.config.apiLiveOrigin + Options._.config.rafflePathname
    const roomID = +dataJson.real_roomid
    this._RaffleCheck(url, roomID)
  }
  /**
   * 检查房间抽奖raffle信息
   *
   * @private
   * @param {string} url
   * @param {number} roomID
   * @memberof Listener
   */
  private async _RaffleCheck(url: string, roomID: number) {
    // 等待3s, 防止土豪刷屏
    await tools.Sleep(3000)
    const check: requestOptions = {
      uri: `${url}/check?${AppClient.signQueryBase(`roomid=${roomID}`)}`,
      json: true
    }
    const raffleCheck = await tools.XHR<raffleCheck>(check, 'Android')
    if (raffleCheck !== undefined && raffleCheck.response.statusCode === 200
      && raffleCheck.body.code === 0 && raffleCheck.body.data.list.length > 0) {
      raffleCheck.body.data.list.forEach(data => {
        const message: message = {
          cmd: data.type === 'small_tv' ? 'smallTV' : 'raffle',
          roomID,
          id: +data.raffleId,
          type: data.type,
          title: data.title,
          time: +data.time,
          max_time: +data.max_time,
          time_wait: +data.time_wait
        }
        this._RaffleHandler(message)
      })
    }
  }
  /**
   * 监听抽奖消息
   *
   * @private
   * @param {raffleMessage | lotteryMessage | beatStormMessage | boxMessage} raffleMessage
   * @memberof Listener
   */
  private _RaffleHandler(raffleMessage: raffleMessage | lotteryMessage | beatStormMessage | boxMessage) {
    const { cmd, id, roomID } = raffleMessage
    switch (cmd) {
      case 'smallTV':
        if (this._smallTVID.has(id)) return
        this._smallTVID.add(id)
        this._dailySmallTVID.add(id)
        break
      case 'raffle':
        if (this._raffleID.has(id)) return
        this._raffleID.add(id)
        this._dailyRaffleID.add(id)
        break
      case 'lottery':
        if (this._lotteryID.has(id)) return
        this._lotteryID.add(id)
        this._dailyLotteryID.add(id)
        break
      case 'beatStorm':
        if (this._beatStormID.has(id)) return
        this._beatStormID.add(id)
        this._dailyBeatStormID.add(id)
        break
      case 'box': break
      default:
        return
    }
    this.emit(cmd, raffleMessage)
    if (cmd !== 'box') this._RoomListener.AddRoom(roomID)
    tools.Log(`房间 ${roomID} 开启了第 ${id} 轮${raffleMessage.title}`)
    this._RoomListener.UpdateDB(roomID, cmd)
  }
  /**
   * 监听抽奖消息2
   *
   * @private
   * @param {lotteryMessage | beatStormMessage} raffleMessage
   * @memberof Listener
   */
  private _RaffleHandler2(lotteryMessage: lotteryMessage | beatStormMessage) {
    const { cmd, id, roomID } = lotteryMessage
    switch (cmd) {
      case 'lottery':
        if (this._lotteryID.has(id)) return
        this._lotteryID.add(id)
        this._dailyLotteryID.add(id)
        break
      case 'beatStorm':
        if (this._beatStormID.has(id)) return
        this._beatStormID.add(id)
        this._dailyBeatStormID.add(id)
        break
      default: return
    }
    this.emit(cmd, lotteryMessage)
    tools.Log(`房间 ${roomID} 开启了第 ${id} 轮${lotteryMessage.title}`)
  }
}
export default Listener
