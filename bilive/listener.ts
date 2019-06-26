import { Options as requestOptions } from 'request'
import { EventEmitter } from 'events'
import tools from './lib/tools'
import AppClient from './lib/app_client'
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
  private _pklotteryID: Set<number> = new Set()
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
   * 消息缓存
   *
   * @private
   * @type {Set<string>}
   * @memberof Listener
   */
  public _MSGCache: Set<string> = new Set()
  /**
   * 开始监听
   *
   * @memberof Listener
   */
  public Start() {
    this._RoomListener = new RoomListener()
    this._RoomListener
      .on('SYS_MSG', dataJson => this._RaffleCheck(dataJson))
      .on('SYS_GIFT', dataJson => this._RaffleCheck(dataJson))
      .on('smallTV', (raffleMessage: raffleMessage) => this._RaffleHandler(raffleMessage))
      .on('raffle', (raffleMessage: raffleMessage) => this._RaffleHandler(raffleMessage))
      .on('lottery', (lotteryMessage: lotteryMessage) => this._RaffleHandler(lotteryMessage))
      .on('pklottery', (lotteryMessage: lotteryMessage) => this._RaffleHandler(lotteryMessage))
      .on('beatStorm', (beatStormMessage: beatStormMessage) => this._RaffleHandler(beatStormMessage))
      .on('lottery2', (lotteryMessage: lotteryMessage) => this._RaffleHandler2(lotteryMessage))
      .on('pklottery2', (lotteryMessage: lotteryMessage) => this._RaffleHandler(lotteryMessage))
      .on('beatStorm2', (beatStormMessage: beatStormMessage) => this._RaffleHandler2(beatStormMessage))
      .Start()
    Options.on('dbTimeUpdate', () => this._RoomListener._AddDBRoom())
    Options.on('globalFlagUpdate', () => this._RoomListener._RefreshLiveRoomListener())
  }
  /**
   * 清空每日ID缓存
   *
   * @memberof Listener
   */
  public clearAllID() {
    this._dailyBeatStormID.clear()
    this._dailySmallTVID.clear()
    this._dailyRaffleID.clear()
    this._dailyLotteryID.clear()
  }
  /**
   * 计算遗漏数量
   *
   * @private
   * @param {Set<number>} Set1
   * @param {Set<number>} Set2
   * @memberof Listener
   */
  private getMisses(Set1: Set<number>, Set2: Set<number>) {
    let query1 = [...Set1]
    let query2 = [...Set2]
    if (query2.length > 0 && query2[0].toString().length > 6) // For beatStorm IDs
      for (let i = 0; i < query2.length; i++) query2[i] = Number(query2[i].toString().slice(0, -6))
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
   * @param {number} int
   * @memberof Listener
   */
  public logAllID(int: number) {
    const raffleMiss = this.getMisses(this._smallTVID, this._raffleID)
    const lotteryMiss = this.getMisses(this._lotteryID, this._beatStormID)
    const dailyRaffleMiss = this.getMisses(this._dailySmallTVID, this._dailyRaffleID)
    const dailyLotteryMiss = this.getMisses(this._dailyLotteryID, this._dailyBeatStormID)
    const allRaffle = raffleMiss + this._smallTVID.size + this._raffleID.size
    const allLottery = lotteryMiss + this._lotteryID.size + this._beatStormID.size
    const dailyAllRaffle = dailyRaffleMiss + this._dailySmallTVID.size + this._dailyRaffleID.size
    const dailyAllLottery = dailyLotteryMiss + this._dailyLotteryID.size + this._dailyBeatStormID.size
    const raffleMissRate = 100 * raffleMiss / (allRaffle === 0 ? 1 : allRaffle)
    const lotteryMissRate = 100 * lotteryMiss / (allLottery === 0 ? 1 : allLottery)
    const dailyRaffleMissRate = 100 * dailyRaffleMiss / (dailyAllRaffle === 0 ? 1 : dailyAllRaffle)
    const dailyLotteryMissRate = 100 * dailyLotteryMiss / (dailyAllLottery === 0 ? 1 : dailyAllLottery)
    let logMsg: string = '\n'
    logMsg += `/********************************* bilive_server 运行信息 *********************************/\n`
    logMsg += `本次监听开始于：${new Date(this._ListenStartTime).toString()}\n`
    logMsg += `已监听房间数：${this._RoomListener.roomListSize()}\n`
    logMsg += `共监听到小电视抽奖数：${this._smallTVID.size}(${this._dailySmallTVID.size})\n`
    logMsg += `共监听到活动抽奖数：${this._raffleID.size}(${this._dailyRaffleID.size})\n`
    logMsg += `共监听到大航海抽奖数：${this._lotteryID.size}(${this._dailyLotteryID.size})\n`
    logMsg += `共监听到节奏风暴抽奖数：${this._beatStormID.size}(${this._dailyBeatStormID.size})\n`
    logMsg += `raffle漏监听：${raffleMiss}(${raffleMissRate.toFixed(1)}%)\n`
    logMsg += `lottery漏监听：${lotteryMiss}(${lotteryMissRate.toFixed(1)}%)\n`
    logMsg += `今日raffle漏监听：${dailyRaffleMiss}(${dailyRaffleMissRate.toFixed(1)}%)\n`
    logMsg += `今日lottery漏监听：${dailyLotteryMiss}(${dailyLotteryMissRate.toFixed(1)}%)\n`
    tools.Log(logMsg)
    let pushMsg: string = ''
    pushMsg += `# bilive_server 监听情况报告\n`
    pushMsg += `- 本次监听开始于：${new Date(this._ListenStartTime).toString()}\n`
    pushMsg += `- 已监听房间数：${this._RoomListener.roomListSize()}\n`
    pushMsg += `- 共监听到小电视抽奖数：${this._smallTVID.size}(${this._dailySmallTVID.size})\n`
    pushMsg += `- 共监听到活动抽奖数：${this._raffleID.size}(${this._dailyRaffleID.size})\n`
    pushMsg += `- 共监听到大航海抽奖数：${this._lotteryID.size}(${this._dailyLotteryID.size})\n`
    pushMsg += `- 共监听到节奏风暴抽奖数：${this._beatStormID.size}(${this._dailyBeatStormID.size})\n`
    pushMsg += `- raffle漏监听：${raffleMiss}(${raffleMissRate.toFixed(1)}%)\n`
    pushMsg += `- lottery漏监听：${lotteryMiss}(${lotteryMissRate.toFixed(1)}%)\n`
    pushMsg += `- 今日raffle漏监听：${dailyRaffleMiss}(${dailyRaffleMissRate.toFixed(1)}%)\n`
    pushMsg += `- 今日lottery漏监听：${dailyLotteryMiss}(${dailyLotteryMissRate.toFixed(1)}%)\n`
    if (int % 8 === 0) tools.sendSCMSG(pushMsg)
  }
  /**
   * 检查房间抽奖raffle信息
   *
   * @private
   * @param {(SYS_MSG | SYS_GIFT)} dataJson
   * @memberof Listener
   */
  private async _RaffleCheck(dataJson: SYS_MSG | SYS_GIFT) {
    if (dataJson.real_roomid === undefined || this._MSGCache.has(dataJson.msg_text)) return
    this._MSGCache.add(dataJson.msg_text)
    const roomID = dataJson.real_roomid
    // 等待3s, 防止土豪刷屏
    await tools.Sleep(3000)
    const _lotteryInfo: requestOptions = {
      uri: `${Options._.config.apiLiveOrigin}/xlive/lottery-interface/v1/lottery/getLotteryInfo?${AppClient.signQueryBase(`roomid=${roomID}`)}`,
      json: true
    }
    const lotteryInfo = await tools.XHR<lotteryInfo>(_lotteryInfo, 'Android')
    if (lotteryInfo !== undefined && lotteryInfo.response.statusCode === 200
      && lotteryInfo.body.code === 0 && lotteryInfo.body.data.gift_list.length > 0) {
      lotteryInfo.body.data.gift_list.forEach(data => {
        const message: message = {
          cmd: 'raffle',
          roomID,
          id: +data.raffleId,
          type: data.type,
          title: data.title,
          time: +data.time_wait,
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
   * @param {raffleMessage | lotteryMessage | beatStormMessage} raffleMessage
   * @memberof Listener
   */
  private _RaffleHandler(raffleMessage: raffleMessage | lotteryMessage | beatStormMessage) {
    const { cmd, id, roomID } = raffleMessage
    switch (cmd) {
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
      case 'pklottery':
        if (this._pklotteryID.has(id)) return
        this._pklotteryID.add(id)
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
      case 'pklottery':
        if (this._pklotteryID.has(id)) return
        this._pklotteryID.add(id)
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
