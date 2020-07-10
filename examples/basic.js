const HideMyNameVPN = require('../build/index').default

const hideMyName = new HideMyNameVPN();

(async () => {
    const proxy = await hideMyName.getRandomProxy({
        maxDelay: 1000,
    });

    console.log(proxy);
})()