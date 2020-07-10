[![NPM](https://nodei.co/npm/hide-my-name-vpn.png)](https://nodei.co/npm/hide-my-name-vpn/)

# HideMyNameVPN ![](https://github.com/hi-imcodeman/hide-my-name-vpn/workflows/CI/badge.svg)

This package will give list of free proxy servers.

Please refer [API Documentation](https://hi-imcodeman.github.io/hide-my-name-vpn) here.

See the [Examples](https://github.com/hi-imcodeman/hide-my-name-vpn/tree/master/examples) here

## Installation

Install using 'npm'

```sh
npm i hide-my-name-vpn
```

Install using 'yarn'

```sh
yarn add hide-my-name-vpn
```

## Usage

```javascript
import HideMyNameVPN from "hide-my-name-vpn";

const hideMyName = new HideMyNameVPN();

(async () => {
  const proxy = await hideMyName.getRandomProxy({
    maxDelay: 1000,
  });

  console.log(proxy);
})();
```
