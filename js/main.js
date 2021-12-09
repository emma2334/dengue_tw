import {
  paintMap,
  drawMonthChart,
  drawAgeChart,
  drawAbroadChart,
} from './render.js'

export default function createMap() {
  this.rawData // Raw data of dengue info
  this.year // Selected year
  this.area = '台灣' // Selected area

  const map = d3.select('svg#map').node().getBoundingClientRect()
  this.width = map.width
  this.height = map.height
  d3.select('svg#map').attr('viewBox', `0 0 ${this.width} ${this.height}`)

  this.path = d3.geo.path().projection(
    d3.geo
      .mercator()
      .center([121, 24])
      .scale(this.height / 0.01 / 8.5)
      .translate([this.width / 2, this.height / 2])
  )
}

createMap.prototype.draw = function ({ city, town }) {
  const { path, mapSvg } = this
  // Append cities
  d3.select('svg#map g.city')
    .selectAll('path')
    .data(city)
    .enter()
    .append('path')
    .attr({ class: d => d.properties['C_Name'], d: path })
    .on('click', d => {
      clickCity.call(this, d)
    })
    .on('mouseover', d => {
      d3.select('#tooltip')
        .html(d.properties['C_Name'])
        .style({ left: `${d3.event.pageX}px`, top: `${d3.event.pageY}px` })
      d3.select('#tooltip').classed('hidden', false)
    })
    .on('mouseout', d => {
      d3.select('#tooltip').classed('hidden', true)
    })

  // Append towns
  d3.select('svg#map g.town')
    .selectAll('path')
    .data(town)
    .enter()
    .append('path')
    .attr({
      class: d => `${d.properties['C_Name']} ${d.properties['T_Name']}`,
      d: path,
    })
    .on('click', d => {
      clickedTown.call(this, d)
    })
    .on('mouseover', d => {
      d3.select('#tooltip')
        .html(d.properties['T_Name'])
        .style({ left: `${d3.event.pageX}px`, top: `${d3.event.pageY}px` })
      d3.select('#tooltip').classed('hidden', false)
    })
    .on('mouseout', function (d) {
      d3.select('#tooltip').classed('hidden', true)
    })
}

createMap.prototype.applyDengueInfo = function (data) {
  this.rawData = data // Update dengue data

  const start = d3.min(data, d => Number(d['發病年份']))
  const end = d3.max(data, d => Number(d['發病年份']))
  this.year = end.toString()

  // Insert year options
  for (let i = end - start; i >= 0; i--) {
    d3.select('#year')
      .insert('option')
      .attr({ value: start + i })
      .html(start + i)
  }

  const latestData = this.dataFilter(end)
  const total = d3
    .nest()
    .rollup(d => d3.sum(d, dd => dd['確定病例數']))
    .entries(latestData)
  d3.select('span.total').html(total)

  paintMap(latestData)
  drawMonthChart(latestData)
  drawAgeChart(latestData)
  drawAbroadChart(latestData)
}

createMap.prototype.dataFilter = function (year, area = '台灣') {
  if (area === '台灣') {
    return this.rawData.filter(d => d['發病年份'] == year)
  } else if (area.split(' ').length === 1) {
    return this.rawData.filter(d => d['發病年份'] == year && d['縣市'] == area)
  } else {
    const tmp = area.split(' ')
    return this.rawData.filter(
      d => d['發病年份'] == year && d['縣市'] == tmp[0] && d['鄉鎮'] == tmp[1]
    )
  }
}

createMap.prototype.change = function () {
  const data = this.dataFilter(this.year, this.area)
  const total = d3
    .nest()
    .rollup(d => d3.sum(d, dd => dd['確定病例數']))
    .entries(data)

  d3.select('span.total').html(total)
  d3.select('span.area').html(this.area.replace(/ /g, ''))

  d3.selectAll('.content svg').html('')
  drawMonthChart(data)
  drawAgeChart(data)
  drawAbroadChart(data)
}

createMap.prototype.changeYear = function (year) {
  this.year = year
  this.change()
  paintMap(this.dataFilter(year))
}

function clickCity(d) {
  // Clear active
  d3.selectAll('.active').classed('active', false)

  // Show town map
  this.area = d.properties.C_Name
  d3.selectAll(`.${this.area}`).classed('active', true)

  const bounds = this.path.bounds(d), // Map boundaries
    dx = bounds[1][0] - bounds[0][0], // Width
    dy = bounds[1][1] - bounds[0][1], // Height
    x = (bounds[0][0] + bounds[1][0]) / 2, // Horizontal center
    y = (bounds[0][1] + bounds[1][1]) / 2, // Vertical center
    scale = 0.9 / Math.max(dx / this.width, dy / this.height),
    translate = [this.width / 2 - scale * x, this.height / 2 - scale * y]

  for (let target of ['city', 'town']) {
    d3.select(`#map g.${target}`)
      .transition()
      .duration(750)
      .style('stroke-width', (target === 'city' ? 5 : 1) / scale + 'px')
      .attr('transform', 'translate(' + translate + ')scale(' + scale + ')')
  }

  this.change()

  // refresh navbar
  d3.select('nav').html(`
    <span onclick="reset()">台灣</span>
    <span class="city" onclick="changeNav()">${this.area}</span>`)
}

createMap.prototype.reset = function () {
  d3.selectAll('.active').classed('active', false)
  this.area = '台灣'
  for (let target of ['city', 'town']) {
    d3.select(`#map g.${target}`)
      .transition()
      .duration(750)
      .style('stroke-width', '1px')
      .attr('transform', '')
  }

  this.change()

  // refresh navbar
  d3.select('nav').html('<span onclick="reset()">台灣</span>')
}

function clickedTown(d) {
  const { C_Name: city, T_Name: town } = d.properties
  this.area = `${city} ${town}`
  this.change()

  // refresh navbar
  d3.select('nav').html(`
    <span onclick="reset()">台灣</span>
    <span class="city" onclick="changeNav()">${city}</span>
    <span class="town" onclick="clickedTown()">${town}</span>`)
}

function changeNav() {
  area = d3.select('span.city').html()
  d3.select('nav').html(`
    <span onclick="reset()">台灣</span>
    <span class="city" onclick="changeNav()">${area}</span>`)
  change()
}
