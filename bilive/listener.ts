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
  /**
   * 数据刷新时间
   *
   * @private
   * @type {number}
   * @memberof Listener
   */
  private _StatRefreshTime: number = Date.now()
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
      .Start()
    Options.on('clientUpdate', () => this._RoomListener._AddDBRoom())
    let i = 0
    setInterval(() => {
      i++
      this.logAllID(i)
    }, 60 * 60 * 1000)
    setInterval(() => this.clearAllID(), 24 * 60 * 60 * 1000)
  }
  /**
   * 清空每日ID缓存
   *
   * @memberof Listener
   */
  private clearAllID() {
    this._StatRefreshTime = Date.now()
    this._dailyBeatStormID.clear()
    this._dailySmallTVID.clear()
    this._dailyRaffleID.clear()
    this._dailyLotteryID.clear()
  }
  /**
   * 计算遗漏数量
   *
   * @param {Array<number>, Array<number>} 
   * @memberof Listener
   */
  private getMisses(query1: Array<number>, query2: Array<number>) {
    let start1 = query1[0] > 0 ? query1[0] : 0
    let end1 = query1[query1.length-1] > 0 ? query1[query1.length-1] : 0
    let start2 = query2[0] > 0 ? query2[0] : 0
    let end2 = query2[query2.length-1] > 0 ? query2[query2.length-1] : 0
    let Start, End: number
    if (start1 > 0 && (start2 === 0 || start1 < start2)) Start = start1
    else if (start2 > 0 && (start1 === 0 || start2 < start1)) Start = start2
    else Start = 0
    if (end1 > 0 && (end2 === 0 || end1 > end2)) End = end1
    else if (end2 > 0 && (end1 === 0 || end2 > end1)) End = end2
    else End = 0
    let Misses = End - Start + 1 - query1.length - query2.length
    if (query1.length + query2.length === 0) Misses -= 1
    return Misses
  }
  /**
   * 监听数据Log
   * 
   * @param {number}
   * @memberof Listener
   */
  private async logAllID(int: number) {
    let smallTVArray = [...this._smallTVID]
    let raffleArray = [...this._raffleID]
    let lotteryArray = [...this._lotteryID]
    let beatStormArray = [...this._beatStormID]
    let dailySmallTVArray = [...this._dailySmallTVID]
    let dailyRaffleArray = [...this._dailyRaffleID]
    let dailyLotteryArray = [...this._dailyLotteryID]
    let dailyBeatStormArray = [...this._dailyBeatStormID]
    for (let n=0; n<this._beatStormID.size; n++) {
      let item = beatStormArray[n]
      let tmp = item.toString().slice(0, -6)
      beatStormArray[n] = Number(tmp)
    }
    for (let n=0; n<this._dailyBeatStormID.size; n++) {
      let item = dailyBeatStormArray[n]
      let tmp = item.toString().slice(0, -6)
      dailyBeatStormArray[n] = Number(tmp)
    }
    let raffleMisses = this.getMisses(smallTVArray, raffleArray)
    let lotteryMisses = this.getMisses(lotteryArray, beatStormArray)
    let dailyRaffleMisses = this.getMisses(dailySmallTVArray, dailyRaffleArray)
    let dailyLotteryMisses = this.getMisses(dailyLotteryArray, dailyBeatStormArray)
    let logMsg: string = '\n'
    logMsg += `/********************************* bilive_server 运行信息 *********************************/\n`
    logMsg += `本次监听开始于：${new Date(this._ListenStartTime).toString()}\n`
    logMsg += `统计数据刷新于：${new Date(this._StatRefreshTime).toString()}\n`
    logMsg += `共监听到小电视抽奖数：${this._smallTVID.size}(${this._dailySmallTVID.size})\n`
    logMsg += `共监听到活动抽奖数：${this._raffleID.size}(${this._dailyRaffleID.size})\n`
    logMsg += `共监听到大航海抽奖数：${this._lotteryID.size}(${this._dailyLotteryID.size})\n`
    logMsg += `共监听到节奏风暴抽奖数：${this._beatStormID.size}(${this._dailyBeatStormID.size})\n`
    logMsg += `raffle漏监听：${raffleMisses}(${(raffleMisses/(raffleMisses+this._smallTVID.size+this._raffleID.size)*100).toFixed(1)}%)\n`
    logMsg += `lottery漏监听：${lotteryMisses}(${(lotteryMisses/(lotteryMisses+this._lotteryID.size+this._beatStormID.size)*100).toFixed(1)}%)\n`
    logMsg += `上次刷新后raffle漏监听：${dailyRaffleMisses}(${(dailyRaffleMisses/(dailyRaffleMisses+this._dailySmallTVID.size+this._dailyRaffleID.size)*100).toFixed(1)}%)\n`
    logMsg += `上次刷新后lottery漏监听：${dailyLotteryMisses}(${(dailyLotteryMisses/(dailyLotteryMisses+this._dailyLotteryID.size+this._dailyBeatStormID.size)*100).toFixed(1)}%)\n`
    tools.Log(logMsg)
    let pushMsg: string = ''
    pushMsg += `# bilive_server 监听情况报告\n`
    pushMsg += `- 本次监听开始于：${new Date(this._ListenStartTime).toString()}\n`
    pushMsg += `- 统计数据刷新于：${new Date(this._StatRefreshTime).toString()}\n`
    pushMsg += `- 共监听到小电视抽奖数：${this._smallTVID.size}(${this._dailySmallTVID.size})\n`
    pushMsg += `- 共监听到活动抽奖数：${this._raffleID.size}(${this._dailyRaffleID.size})\n`
    pushMsg += `- 共监听到大航海抽奖数：${this._lotteryID.size}(${this._dailyLotteryID.size})\n`
    pushMsg += `- 共监听到节奏风暴抽奖数：${this._beatStormID.size}(${this._dailyBeatStormID.size})\n`
    pushMsg += `- raffle漏监听：${raffleMisses}(${(raffleMisses/(raffleMisses+this._smallTVID.size+this._raffleID.size)*100).toFixed(1)}%)\n`
    pushMsg += `- lottery漏监听：${lotteryMisses}(${(lotteryMisses/(lotteryMisses+this._lotteryID.size+this._beatStormID.size)*100).toFixed(1)}%)\n`
    pushMsg += `- 上次刷新后raffle漏监听：${dailyRaffleMisses}(${(dailyRaffleMisses/(dailyRaffleMisses+this._dailySmallTVID.size+this._dailyRaffleID.size)*100).toFixed(1)}%)\n`
    pushMsg += `- 上次刷新后lottery漏监听：${dailyLotteryMisses}(${(dailyLotteryMisses/(dailyLotteryMisses+this._dailyLotteryID.size+this._dailyBeatStormID.size)*100).toFixed(1)}%)\n`
    if (int % 6 === 0) tools.sendSCMSG(pushMsg)
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
        if (modules.module_info.type !== 2 && modules.list.length > 2) {
          for (let i = 0; i < modules.list.length; i++) roomIDs.add((<getAllListDataRoomList>modules.list[i]).roomid)
        }
      })
      // 添加房间
      roomIDs.forEach(roomID => {
        if (this._DMclient.has(roomID)) return
        const newDMclient = new DMclient({ roomID })
        newDMclient
          .on('TV_START', dataJson => this._RaffleStartHandler(dataJson))
          .on('RAFFLE_START', dataJson => this._RaffleStartHandler(dataJson))
          .on('LOTTERY_START', dataJson => this._LotteryStartHandler(dataJson))
          .on('GUARD_LOTTERY_START', dataJson => this._LotteryStartHandler(dataJson))
          .on('SPECIAL_GIFT', dataJson => this._SpecialGiftHandler(dataJson))
          .on('ALL_MSG', dataJson => {
          if (!Options._.config.excludeCMD.includes(dataJson.cmd)) tools.Log(JSON.stringify(dataJson))
        })
        .Connect({ server: 'livecmt-2.bilibili.com', port: 2243 })
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
   * 监听抽奖
   *
   * @private
   * @param {RAFFLE_START} dataJson
   * @memberof Listener
   */
  private _RaffleStartHandler(dataJson: RAFFLE_START) {
    if (dataJson.data === undefined || dataJson.data.raffleId === undefined) return
    const cmd = dataJson.data.type === 'small_tv' ? 'smallTV' : 'raffle'
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
    this._RaffleHandler(raffleMessage)
  }
  /**
   * 监听快速抽奖
   *
   * @private
   * @param {LOTTERY_START} dataJson
   * @memberof Listener
   */
  private _LotteryStartHandler(dataJson: LOTTERY_START) {
    if (dataJson.data === undefined || dataJson.data.id === undefined) return
    const lotteryMessage: lotteryMessage = {
      cmd: 'lottery',
      roomID: dataJson._roomid,
      id: +dataJson.data.id,
      type: dataJson.data.type,
      title: '舰队抽奖',
      time: +dataJson.data.lottery.time
    }
    this._RaffleHandler(lotteryMessage)
  }
  /**
   * 监听特殊礼物消息
   *
   * @private
   * @param {SPECIAL_GIFT} dataJson
   * @memberof Listener
   */
  private _SpecialGiftHandler(dataJson: SPECIAL_GIFT) {
    if (dataJson.data['39'] !== undefined) this._BeatStormHandler(dataJson)
  }
  /**
   * 监听节奏风暴消息
   *
   * @private
   * @param {SPECIAL_GIFT} dataJson
   * @memberof Listener
   */
  private _BeatStormHandler(dataJson: SPECIAL_GIFT) {
    const beatStormData = dataJson.data['39']
    // @ts-ignore
    if (beatStormData.content !== undefined) {
      const beatStormMessage: beatStormMessage = {
        cmd: 'beatStorm',
        roomID: dataJson._roomid,
        id: +beatStormData.id,
        type: 'beatStorm',
        title: '节奏风暴',
        // @ts-ignore
        time: beatStormData.time
      }
      this._RaffleHandler(beatStormMessage)
    }
  }
  /**
   * 监听抽奖消息
   *
   * @private
   * @param {raffleMessage | lotteryMessage | beatStormMessage} raffleMessage
   * @memberof Listener
   */
  private _RaffleHandler(raffleMessage: raffleMessage | lotteryMessage | beatStormMessage) {
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
      default:
        return
    }
    this.emit(cmd, raffleMessage)
    this._RoomListener.AddRoom(roomID)
    tools.Log(`房间 ${roomID} 开启了第 ${id} 轮${raffleMessage.title}`)
    this._RoomListener.UpdateDB(roomID, cmd)
  }
}
export default Listener
