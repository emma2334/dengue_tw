import createMap from './main.js'

;(function () {
  const map = new createMap()
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
    map.draw({ city, town })
  })

  d3.json('./data/Age_County_Gender_061.json', (error, data) => {
    map.applyDengueInfo(data)
  })

  document.getElementById('year').onchange = e => {
    map.update({ year: e.target.value })
  }

  document.querySelector('#map rect.background').onclick = map.reset.bind(map)
  window.reset = map.reset.bind(map)

  document.querySelector('nav .city').onclick = e => {
    map.update({ area: e.target.innerText })
    document.querySelector('nav .town').innerText = ''
  }
})()
