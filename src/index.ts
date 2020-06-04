import puppeteer from 'puppeteer'
import lowdb from 'lowdb'
import { v5 as uuid5 } from 'uuid'
import lowdbFileSync from 'lowdb/adapters/FileSync'
import cheerio from 'cheerio'
import _ from 'lodash'

export const sleep = (ms: number) => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve()
        }, ms)
    })
}
export enum ProxyType {
    HTTP = 'h',
    HTTPS = 's',
    SOCKS4 = 4,
    SOCKS5 = 5
}
const proxyTypeMapping = {
    'HTTP': 'h',
    'HTTPS': 's',
    'SOCKS4': 4,
    'SOCKS5': 5
}
export enum Anonymity {
    No = 1,
    Low,
    Average,
    High
}
const anonymityMapping = {
    'no': 1,
    'Low': 2,
    'Average': 3,
    'High': 4
}
interface QueryOptions {
    type?: ProxyType[]
    anonymity?: Anonymity[]
    maxDelay?: number
    /**
     * 2-letter country code
     */
    countryCode?: string[]
    ports?: number[]
}

export interface ProxyPerformanceDetails {
    host: any
    port: number
    responseTime: number
    statusCode: number
    statusText: string
    errorCode?: string
    errorMessage?: string
}

export default class HideMyNameVPN {
    private _baseUrl = 'https://hidemy.name'
    private _db: any

    constructor() {
        const adapter = new lowdbFileSync('db.json')
        this._db = lowdb(adapter)
        this._db.defaults({ proxyList: [], metadata: {} })
            .write()
    }
    private _storeToDb(proxyList: any, isPremium = false): void {
        proxyList.map((proxy: any) => {
            if (isPremium)
                proxy.isPremium = isPremium
            if (proxy.anon) {
                proxy.anonymity = _.findKey(anonymityMapping, value => value === Number(proxy.anon))
                proxy.anon = undefined
            }
            if (proxy.http || proxy.ssl || proxy.socks4 || proxy.socks5) {
                const types: string[] = []
                const { http, ssl, socks4, socks5 } = proxy
                if (Number(http))
                    types.push('HTTP')
                if (Number(ssl))
                    types.push('HTTPS')
                if (Number(socks4))
                    types.push('SOCKS4')
                if (Number(socks5))
                    types.push('SOCKS5')
                proxy.type = types.join(', ')
                proxy.http = undefined
                proxy.ssl = undefined
                proxy.socks4 = undefined
                proxy.socks5 = undefined
            }
            const id = uuid5(`${proxy.host}:${proxy.port}`, uuid5.DNS)
            const exsitingData = this._db.get('proxyList').find({ id }).value()
            if (exsitingData) {
                this._db.get('proxyList').find({ id }).assign({ ...proxy, updatedOn: new Date().toISOString() }).write()
            } else {
                this._db.get('proxyList').push({ id, ...proxy, createdOn: new Date().toISOString() }).write()
            }
        })
        const totalProxys = this._db.get('proxyList').value()
        this._db.set('metadata.count', totalProxys.length).write()
        this._db.set('metadata.updatedOn', new Date().toISOString()).write()
    }
    async getRandomProxy(options?: QueryOptions): Promise<any> {
        let proxies = this._filterProxies(options)
        if (!proxies.length) {
            await this.getProxyList(options)
            proxies = this._filterProxies(options)
            return Promise.resolve(proxies[_.random(proxies.length)] || null)
        } else {
            return Promise.resolve(proxies[_.random(proxies.length)] || null)
        }
    }
    private _filterProxies(options?: QueryOptions): any[] {
        let proxies = this._db.get('proxyList').filter(obj => obj.status != 'inactive').value()
        if (options.maxDelay)
            proxies = _.filter(proxies, obj => obj.delay <= options.maxDelay)
        if (options.ports && options.ports.length)
            proxies = _.filter(proxies, (obj) => options.ports.includes(obj.port))
        if (options.anonymity && options.anonymity.length) {
            proxies = _.filter(proxies, (obj) => {
                return options.anonymity.includes(anonymityMapping[obj.anonymity])
            })
        }
        if (options.type && options.type.length) {
            proxies = _.filter(proxies, obj => {
                const filtered = obj.type.split(', ').filter(item => options.type.includes(proxyTypeMapping[item]))
                return filtered.length
            })
        }

        return proxies
    }
    updateProxyPerformance(details: ProxyPerformanceDetails) {
        const { host, port, statusCode, statusText, responseTime, errorCode, errorMessage } = details
        const proxyDetails = this._db.get('proxyList').find({ host, port }).value()
        let status = proxyDetails.status || 'active'
        let requestCount = proxyDetails.requestCount || 0
        requestCount++

        let successCount = proxyDetails.successCount || 0
        if (statusCode <= 299 && statusCode >= 200)
            successCount++

        let declineCount = proxyDetails.declineCount || 0
        if (statusCode >= 400 && statusCode <= 499)
            declineCount++

        let failureCount = proxyDetails.failureCount || 0
        if (statusCode >= 500 && statusCode <= 599)
            failureCount++

        let errorCount = proxyDetails.errorCount || 0
        if (errorCode)
            errorCount++

        let timeoutCount = proxyDetails.timeoutCount || 0
        if (errorCode === 'ETIMEDOUT')
            timeoutCount++

        const successPercent = Math.round((successCount / requestCount) * 100)
        const declinePercent = Math.round((declineCount / requestCount) * 100)
        if (declineCount >= 5 && declinePercent >= 80)
            status = 'inactive'

        const failurePercent = Math.round((failureCount / requestCount) * 100)
        if (failureCount >= 10 && failurePercent >= 80)
            status = 'inactive'
        const errorPercent = Math.round((errorCount / requestCount) * 100)
        if (errorCode && errorCount >= 5 && errorPercent === 100)
            status = 'inactive'

        const lastResponseTime = proxyDetails.avgResponseTime || 0
        let avgResponseTime = responseTime
        if (lastResponseTime)
            avgResponseTime = Math.round((lastResponseTime + responseTime) / 2)

        this._storeToDb([{
            host,
            port,
            requestCount,
            successCount,
            successPercent,
            declineCount,
            declinePercent,
            failureCount,
            failurePercent,
            errorCount,
            errorPercent,
            timeoutCount,
            status,
            avgResponseTime,
            recentDetails: {
                statusCode,
                statusText,
                responseTime,
                errorCode,
                errorMessage,
                updatedOn: new Date().toISOString()
            }
        }])
    }
    private _buildQueryString(options?: QueryOptions): string {
        const queryParams: string[] = []
        if (options) {
            if (options.countryCode)
                queryParams.push(`country=${options.countryCode.join('')}`)
            if (options.maxDelay)
                queryParams.push(`maxtime=${options.maxDelay}`)
            if (options.ports)
                queryParams.push(`ports=${options.ports.join(',')}`)
            if (options.type)
                queryParams.push(`type=${options.type.join('')}`)
            if (options.anonymity)
                queryParams.push(`anon=${options.anonymity.join('')}`)
        }
        return queryParams.join('&')
    }
    async getProxyList(options?: QueryOptions) {
        let browser: puppeteer.Browser
        const proxyList: any = []
        let pageCount = 0
        let proxyCount = 0
        const pageLimit = 50
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            const queryString = this._buildQueryString(options)
            let rowCount = 0
            do {
                const start = pageCount * pageLimit
                await page.goto(`${this._baseUrl}/en/proxy-list/?start=${start}${queryString ? '&' + queryString : ''}`, { waitUntil: 'networkidle0' });
                await page.waitFor('div.services_proxylist.services > div > div.table_block', { timeout: 30000 })
                const proxyTable = await page.$eval('div.services_proxylist.services > div > div.table_block', elem => elem.outerHTML)
                const $ = cheerio.load(proxyTable)
                const allTableRows = $('table tbody tr')
                rowCount = allTableRows.length
                allTableRows.each((_: number, elem: any) => {
                    const children = $(elem).children()
                    const ip = $(children[0]).text()
                    const port = Number($(children[1]).text())
                    const country = $(children[2]).find('.country').text()
                    const city = $(children[2]).find('.city').text()
                    const delay = Number($(children[3]).text().replace('ms', ''))
                    const type = $(children[4]).text()
                    const anonymity = $(children[5]).text()
                    const lastUpdate = $(children[6]).text()
                    const proxyDetail = { host: ip, ip, port, country_name: country, city, delay, type, anonymity, lastUpdate }
                    proxyList.push(proxyDetail)
                    this._storeToDb([proxyDetail])
                    proxyCount++
                })
                pageCount++
            } while (rowCount);
            await browser.close()
            return Promise.resolve(proxyCount)
        } catch (error) {
            browser.close()
            return Promise.reject(error)
        }
    }
    /**
     * 
     */
    async getProxyListFromAPI(code: number): Promise<any> {
        try {
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            const response = await page.goto(`${this._baseUrl}/api/proxylist.txt?out=js&lang=en`, { waitUntil: 'load' });
            let content = await response?.text()
            if (content && content?.indexOf('submit') > -1) {
                await page.type('body > form > input[type=text]:nth-child(1)', code.toString())
                await page.click('body > form > input[type=submit]:nth-child(2)')
                const response = await page.waitForNavigation({ waitUntil: 'networkidle0' })
                content = await response?.text()
                if (content.indexOf('error')) {
                    const error = await page.$eval('#message > div > div > p', elem => elem.innerHTML)
                    await browser.close()
                    return Promise.reject(error.split('<br>')[1])
                } else {
                    const json = await response?.json()
                    await browser.close()
                    this._storeToDb(json, true)
                    return Promise.resolve(json)
                }

            } else {
                const json = await response?.json()
                await browser.close()
                this._storeToDb(json, true)
                return Promise.resolve(json)
            }
        } catch (error) {
            return Promise.reject(error)
        }
    }
}