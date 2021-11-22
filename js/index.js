import { createMap, applyDengueInfo } from './main.js'
;(function () {
  Promise.all(
    ['city', 'town'].map(
      e =>
        new Promise(resolve => {
          d3.json(`./data/${e}.json`, data => {
            resolve(topojson.feature(data, data.objects[e]).features)
          })
        })
    )
  ).then(function ([city, town]) {
    createMap({ city, town })
  })

  d3.json('./data/Age_County_Gender_061.json', (error, data) => {
    applyDengueInfo(data)
  })
})()
