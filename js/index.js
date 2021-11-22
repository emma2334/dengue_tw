import { createMap } from './main.js'
;(function () {
  const getCity = new Promise(resolve => {
    d3.json('./data/city.json', topodata => {
      resolve(topojson.feature(topodata, topodata.objects['city']).features)
    })
  })

  const getTown = new Promise(resolve => {
    d3.json('./data/town.json', topodata => {
      resolve(topojson.feature(topodata, topodata.objects['town']).features)
    })
  })
  Promise.all([getCity, getTown]).then(function (data) {
    var [cities, towns] = data

    // map
    createMap({ city: cities, town: towns })
  })
})()
