import WSServer from './wsserver'
import Listener from './listener'

/**
 * 主程序
 *
 * @export
 * @class BiLive
 */
class BiLive {
  constructor() {}
  private _Listener!: Listener
  private _WSServer!: WSServer
  // 全局计时器
  private _lastTime = ''
  public loop!: NodeJS.Timer
  /**
   * 开始主程序
   *
   * @memberof BiLive
   */
  public async Start() {
    // 开启监听
    this._WSServer = new WSServer()
    this._WSServer.Start()
    this.Listener()
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
    if (cstMin === 59) this._Listener.logAllID(cstHour + 1)
    if (cstString === '00:00') {
      this._Listener.clearAllID()
      this._Listener._MSGCache.clear()
    }
  }
  /**
   * 监听系统消息
   *
   * @memberof BiLive
   */
  public Listener() {
    this._Listener = new Listener()
    this._Listener
      .on('smallTV', raffleMessage => this._WSServer.SmallTV(raffleMessage))
      .on('raffle', raffleMessage => this._WSServer.Raffle(raffleMessage))
      .on('lottery', lotteryMessage => this._WSServer.Lottery(lotteryMessage))
      .on('beatStorm', beatStormMessage => this._WSServer.BeatStorm(beatStormMessage))
      .Start()
  }
}

export default BiLive