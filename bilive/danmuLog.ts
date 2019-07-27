import fs from 'fs'
import util from 'util'
import { EventEmitter } from 'events'
const FSwriteFile = util.promisify(fs.writeFile)

/**
 * 
 * @class DanmuLib
 * @extends EventEmitter
 */
class DanmuLib extends EventEmitter {
  constructor() {
    super()
    this._danmuLibPath = __dirname + '/../../options/danmuLib.json'
    const hasFile = fs.existsSync(this._danmuLibPath)
    if (hasFile) {
      const danmuLibBuffer = fs.readFileSync(this._danmuLibPath)
      const danmuLib = <danmuLib>JSON.parse(danmuLibBuffer.toString())
      if (danmuLib === undefined) throw new TypeError('文件格式化失败')
      this._ = danmuLib
    }
  }
  private _danmuLibPath: string
  public _: danmuLib = {}
  public async add(item: any) {
    const cmd = item['cmd']
    if (this._[cmd] === undefined) {
      this._[cmd] = item
      await this.save()
    }
  }
  public async save() {
    const error = await FSwriteFile(this._danmuLibPath, JSON.stringify(this._, null, 2))
    if (error !== undefined) console.error(`${new Date().toString().slice(4, 24)} :`, error)
    return this._
  }
}

interface danmuLib {
  [index: string]: any
}

export default new DanmuLib()
