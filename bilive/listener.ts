import { EventEmitter } from 'events'
import tools from './lib/tools'
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
  /**
   * 抽奖ID
   *
   * @private
   * @type {Set<number>}
   * @memberof Listener
   */
  private _raffleID: Set<number> = new Set()
  /**
   * 快速抽奖ID
   *
   * @private
   * @type {Set<number>}
   * @memberof Listener
   */
  private _lotteryID: Set<number> = new Set()
  /**
   * 节奏风暴ID
   *
   * @private
   * @type {Set<number>}
   * @memberof Listener
   */
  private _beatStormID: Set<number> = new Set()
  /**
   * 房间监听
   *
   * @private
   * @type {RoomListener}
   * @memberof Listener
   */
  private _RoomListener!: RoomListener
  /**
   * 开始监听
   *
   * @memberof Listener
   */
  public Start() {
    this._RoomListener = new RoomListener()
    this._RoomListener
      .on('smallTV', (raffleMessage: raffleMessage) => this._RaffleHandler(raffleMessage))
      .on('raffle', (raffleMessage: raffleMessage) => this._RaffleHandler(raffleMessage))
      .on('lottery', (lotteryMessage: lotteryMessage) => this._RaffleHandler(lotteryMessage))
      .on('beatStorm', (beatStormMessage: beatStormMessage) => this._RaffleHandler(beatStormMessage))
      .Start()
    Options.on('clientUpdate', () => this._RoomListener._AddDBRoom())
    setInterval(() => this.logAllID(), 6 * 60 * 60 * 1000)
  }
  /**
   * log ID cache and calculate missing rate
   * 
   * @memberof Listener
   */
  public async logAllID() {
    let smallTVSize = this._smallTVID.size
    let raffleSize = this._raffleID.size
    let lotterySize = this._lotteryID.size
    let beatStormSize = this._beatStormID.size
    let smallTVArray = [...this._smallTVID]
    let raffleArray = [...this._raffleID]
    let lotteryArray = [...this._lotteryID]
    let beatStormArray = [...this._beatStormID]
    for (let n=0; n<beatStormSize; n++) {
      let item = beatStormArray[n]
      let tmp = item.toString().slice(0, -6)
      beatStormArray[n] = Number(tmp)
    }
    let smallTVStart = smallTVArray[0] > 0 ? smallTVArray[0] : 0
    let smallTVEnd = smallTVArray[smallTVSize-1] > 0 ? smallTVArray[smallTVSize-1] : 0
    let raffleStart = raffleArray[0] > 0 ? raffleArray[0] : 0
    let raffleEnd = raffleArray[raffleSize-1] > 0 ? raffleArray[raffleSize-1] : 0
    let lotteryStart = lotteryArray[0] > 0 ? lotteryArray[0] : 0
    let lotteryEnd = lotteryArray[lotterySize-1] > 0 ? lotteryArray[lotterySize-1] : 0
    let beatStormStart = beatStormArray[0] > 0 ? beatStormArray[0] : 0
    let beatStormEnd = beatStormArray[beatStormSize-1] ? beatStormArray[beatStormSize-1] : 0
    let RaffleStart, RaffleEnd, LotteryStart, LotteryEnd: number
    if (smallTVStart > 0 && (raffleStart === 0 || smallTVStart < raffleStart)) RaffleStart = smallTVStart
    else if (raffleStart > 0 && (smallTVStart === 0 || raffleStart < smallTVStart)) RaffleStart = raffleStart
    else RaffleStart = 0
    if (smallTVEnd > 0 && (raffleEnd === 0 || smallTVEnd > raffleEnd)) RaffleEnd = smallTVEnd
    else if (raffleEnd > 0 && (smallTVEnd === 0 || raffleEnd > smallTVEnd)) RaffleEnd = raffleEnd
    else RaffleEnd = 0
    if (lotteryStart > 0 && (beatStormStart === 0 || lotteryStart < beatStormStart)) LotteryStart = lotteryStart
    else if (beatStormStart > 0 && (beatStormStart === 0 || beatStormStart < lotteryStart)) LotteryStart = beatStormStart
    else LotteryStart = 0
    if (lotteryEnd > 0 && (beatStormEnd === 0 || lotteryEnd > beatStormEnd)) LotteryEnd = lotteryEnd
    else if (beatStormEnd > 0 && (lotteryEnd === 0 || beatStormEnd > lotteryEnd)) LotteryEnd = beatStormEnd
    else LotteryEnd = 0
    let raffleMisses = RaffleEnd - RaffleStart + 1 - smallTVSize - raffleSize
    if (smallTVSize + raffleSize === 0) raffleMisses -= 1
    let lotteryMisses = LotteryEnd - LotteryStart + 1 - lotterySize - beatStormSize
    if (lotterySize + beatStormSize === 0) lotteryMisses -= 1
    let logMsg: string = '\n'
    logMsg += `/********************************* bilive_server 运行信息 *********************************/\n`
    logMsg += `共监听到小电视抽奖数：${smallTVSize}\n`
    logMsg += `共监听到活动抽奖数：${raffleSize}\n`
    logMsg += `共监听到大航海抽奖数：${lotterySize}\n`
    logMsg += `共监听到节奏风暴抽奖数：${beatStormSize}\n`
    logMsg += `raffle漏监听：${raffleMisses}(${(raffleMisses/(raffleMisses+smallTVSize+raffleSize)*100).toFixed(1)}%)\n`
    logMsg += `lottery漏监听：${lotteryMisses}(${(lotteryMisses/(lotteryMisses+lotterySize+beatStormSize)*100).toFixed(1)}%)\n`
    tools.Log(logMsg)
    let pushMsg: string = ''
    pushMsg += `### bilive_server 监听情况报告\n`
    pushMsg += `- 共监听到小电视抽奖数：${smallTVSize}\n`
    pushMsg += `- 共监听到活动抽奖数：${raffleSize}\n`
    pushMsg += `- 共监听到大航海抽奖数：${lotterySize}\n`
    pushMsg += `- 共监听到节奏风暴抽奖数：${beatStormSize}\n`
    pushMsg += `- raffle漏监听：${raffleMisses}(${(raffleMisses/(raffleMisses+smallTVSize+raffleSize)*100).toFixed(1)}%)\n`
    pushMsg += `- lottery漏监听：${lotteryMisses}(${(lotteryMisses/(lotteryMisses+lotterySize+beatStormSize)*100).toFixed(1)}%)\n`
    tools.sendSCMSG(pushMsg)
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
        break
      case 'raffle':
        if (this._raffleID.has(id)) return
        this._raffleID.add(id)
        break
      case 'lottery':
        if (this._lotteryID.has(id)) return
        this._lotteryID.add(id)
        break
      case 'beatStorm':
        if (this._beatStormID.has(id)) return
        this._beatStormID.add(id)
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
