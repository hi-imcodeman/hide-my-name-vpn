import HideMyNameVPN, { ProxyType, sleep } from './index'
import axios from 'axios'

// eslint-disable-next-line
const HttpsProxyAgent = require('https-proxy-agent');

jest.setTimeout((1000 * 60 * 30))
describe('class: HideMyNameVPN', () => {
    const hideMyName = new HideMyNameVPN()
    const checkGoogle = async (i: number) => {
        const proxy = await hideMyName.getRandomProxy({
            type: [ProxyType.HTTPS, ProxyType.HTTP]
        });
        if (proxy && proxy.host) {
            const proxyUrl = `http://${proxy.host}:${proxy.port}`
            const proxyInfo = { proxyUrl, proxyType: proxy.type, anonymity: proxy.anonymity }
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
                    const { status, statusText } = error.response
                    console.log('Error:', { i, status, statusText, duration, ...proxyInfo });
                    hideMyName.updateProxyPerformance({
                        host: proxy.host,
                        port: proxy.port,
                        statusCode: status,
                        statusText,
                        responseTime: duration
                    })
                } else {
                    const { code, errno, message } = error
                    console.log('Error:', { i, code, errno, message, duration, ...proxyInfo });
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
    test('Should return "Code not found" for invalid code', async (done) => {
        const proxy = await hideMyName.getProxyListFromAPI(Number('4872862864824628482'));
        expect(proxy).toBe('Code not found')
        done()
    })
    test('getProxyListFromAPI', async (done) => {
        const proxy = await hideMyName.getProxyListFromAPI(Number(process.env.HIDE_MY_NAME_VPN_CODE));
        expect(proxy.length).toBeGreaterThan(100)
        done()
    })
    test('getProxyList', async (done) => {
        const proxy = await hideMyName.getProxyList({
            type: [ProxyType.HTTP],
            maxDelay: 1000
        });
        expect(proxy.length).toBeGreaterThan(100)
        done()
    })
    test('getRandomProxy()', async (done) => {
        const proxy = await hideMyName.getRandomProxy({
            type: [ProxyType.HTTPS],
            maxDelay: 1000
        });
        expect(proxy.delay).toBeLessThanOrEqual(1000)
        done()
    })
    test.skip('test proxies()', async (done) => {
        for (let i = 1; i <= 5; i++) {
            for (let j = 1; j <= 5; j++) {
                checkGoogle(i * j)
            }
            console.log('Wait for 5secs........');
            await sleep(5000)
        }
        await sleep((1000 * 60 * 30))
        done()
    })
})