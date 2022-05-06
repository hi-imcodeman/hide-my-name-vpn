import HideMyNameVPN, { ProxyType, Anonymity, sleep } from './index'
import axios from 'axios'

// eslint-disable-next-line
const HttpsProxyAgent = require('https-proxy-agent');

jest.setTimeout((1000 * 60 * 30))
describe('class: HideMyNameVPN', () => {
    const hideMyName = new HideMyNameVPN()
    const checkGoogle = async (i: number) => {
        const proxy = await hideMyName.getRandomProxy({
            type: [ProxyType.HTTPS, ProxyType.HTTP],
            maxDelay: 30
        });
        if (proxy && proxy.host) {
            const proxyUrl = `http://${proxy.host}:${proxy.port}`
            const proxyInfo = { proxyUrl, proxyType: proxy.type, anonymity: proxy.anonymity, maxDelay:proxy.delay }
            const httpsAgent = new HttpsProxyAgent(proxyUrl)
            const startTs = new Date().getTime()
            console.log(`${i}) request started on ${new Date().toLocaleTimeString()}`);
            try {
                const response = await axios.get('https://google.com', {
                    httpsAgent,
                    timeout: 5000
                })
                const duration = new Date().getTime() - startTs
                const { status, statusText } = response
                console.log('Success:', { i, status, statusText, duration, ...proxyInfo });
                hideMyName.updateProxyPerformance({
                    host: proxy.host,
                    port: proxy.port,
                    statusCode: status,
                    statusText,
                    responseTime: duration
                })
            } catch (error) {
                const duration = new Date().getTime() - startTs
                if (error.response) {
                    const { status, statusText, data } = error.response
                    console.log('Error:', { i, status, statusText, duration, ...proxyInfo, data });
                    hideMyName.updateProxyPerformance({
                        host: proxy.host,
                        port: proxy.port,
                        statusCode: status,
                        statusText,
                        responseTime: duration
                    })
                } else {
                    const { code, errno, message } = error
                    console.log('Error without Response:', { i, code, errno, message, duration, ...proxyInfo });
                    hideMyName.updateProxyPerformance({
                        host: proxy.host,
                        port: proxy.port,
                        statusCode: 0,
                        statusText: '',
                        responseTime: duration,
                        errorCode: code,
                        errorMessage: message
                    })
                }

            }
        } else {
            console.log('Error Proxy:', proxy);
        }
    }
    test.skip('Should return "Code not found" for invalid code', async (done) => {
        const proxy = await hideMyName.getProxyListFromAPI(Number('4872862864824628482'));
        expect(proxy).toBe('Code not found')
        done()
    })
    test.skip('getProxyListFromAPI', async (done) => {
        const proxy = await hideMyName.getProxyListFromAPI(Number(process.env.HIDE_MY_NAME_VPN_CODE));
        expect(proxy.length).toBeGreaterThan(100)
        done()
    })
    test('getProxyList', async (done) => {
        const proxy = await hideMyName.getProxyList({
            type: [ProxyType.HTTP,ProxyType.HTTPS,ProxyType.SOCKS4,ProxyType.SOCKS5],
            anonymity: [Anonymity.No,Anonymity.Low,Anonymity.High,Anonymity.Average],
            ports: [80,443],
            maxDelay: 1000
        },2);
        console.log('proxy.length:', proxy.length);
        expect(proxy.length).toBeGreaterThan(100)
        done()
    })
    test('getRandomProxy', async (done) => {
        const proxy = await hideMyName.getRandomProxy({
            type: [ProxyType.HTTP],
            maxDelay: 1000
        });
        console.log(proxy);
        expect(proxy.delay).toBeLessThanOrEqual(1000)
        done()
    })
    test('test proxies()', async (done) => {
        const promises:Promise<void>[]=[]
        for (let i = 1; i <= 5; i++) {
            for (let j = 1; j <= 5; j++) {
                promises.push(checkGoogle(i * j))
            }
            console.log('Wait for 5secs........');
            await sleep(5000)
        }
        await Promise.all(promises)
        done()
    })
})