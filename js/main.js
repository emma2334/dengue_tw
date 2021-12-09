import { paintMap, drawMonthChart, drawAgeChart, drawAbroadChart } from './render.js'

export default function createMap() {
  this.year = new Date().getFullYear()
  this.area = '台灣'

  // set up map data
  this.map = d3.select("svg#map").node().getBoundingClientRect();
  this.width = this.map.width
  this.height = this.map.height
  this.svg = d3.select("svg#map").attr('viewBox', `0 0 ${this.map.width} ${this.map.height}`);
  const projection = d3.geo.mercator()
    .center([121,24])
    .scale(this.map.height/0.01/8.5)
    .translate([this.map.width / 2, this.map.height / 2]);
  this.path = d3.geo.path().projection(projection);
}

createMap.prototype.draw = function ({ city, town }) {
  const { path, mapSvg } = this
  // Append cities
  this.svg
    .append('g')
    .attr('class', 'city active')
    .selectAll('path')
    .data(city)
    .enter()
    .append('path')
    .attr({ class: d => d.properties['C_Name'], d: path })
    .on('click', (d) =>{
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
  this.svg
    .append('g')
    .attr('class', 'town')
    .selectAll('path')
    .data(town)
    .enter()
    .append('path')
    .attr({
      class: d => `${d.properties['C_Name']} ${d.properties['T_Name']}`,
      d: path,
    })
    .on('click', clickedTown)
    .on('mouseover', d => {
      d3.select('#tooltip')
        .html(d.properties['T_Name'])
        .style({ left: `${d3.event.pageX}px`, top: `${d3.event.pageY}px` })
      d3.select('#tooltip').classed('hidden', false)
    })
    .on('mouseout', function (d) {
      d3.select('#tooltip').classed('hidden', true)
    })

    this.mapSvg = [ d3.select("#map g.city"), d3.select("#map g.town")];
}

createMap.prototype.applyDengueInfo = function (data) {
  this.rawData = data

  const start = d3.min(data, d => Number(d['發病年份']))
  const end = d3.max(data, d => Number(d['發病年份']))
  this.year = end.toString()
  Array(end - start + 1)
    .fill()
    .forEach((e, i) => {
      d3.select('#year').insert('option').attr({ value: end - i }).html(end - i)
    })

  const latestData = this.dataFilter(end)
  const total = d3.nest().rollup(d => d3.sum(d, dd => dd['確定病例數'])).entries(latestData);
  d3.select("span.total").html(total);

  paintMap(latestData)
  drawMonthChart(data)
  drawAgeChart(data)
  drawAbroadChart(data)
}

createMap.prototype.dataFilter = function (year, area = '台灣') {
  if(area === "台灣"){
    return this.rawData.filter(d => d["發病年份"] == year)
  } else if(area.split(" ").length === 1){
    return this.rawData.filter(d => d["發病年份"] == year && d["縣市"] == area)
  } else {
    const tmp = area.split(" ");
    return this.rawData.filter(d => d["發病年份"] == year && d["縣市"] == tmp[0] && d["鄉鎮"] == tmp[1])
  }
}

createMap.prototype.change = function () {
  const data = this.dataFilter(this.year, this.area)
  const total = d3.nest().rollup(d => d3.sum(d, dd => dd['確定病例數'])).entries(data)

  d3.select("span.total").html(total)
  d3.select("span.area").html(this.area.replace(/ /g, ''))

  d3.selectAll(".content svg").html("");
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
  d3.selectAll(`.${this.area}`).classed("active", false);

  // Show town map
  this.area = d.properties.C_Name
  const active = d3.select(`.${this.area}`);
  d3.selectAll(`.${this.area}`).classed("active", true);

  var bounds = this.path.bounds(d),
    dx = bounds[1][0] - bounds[0][0],
    dy = bounds[1][1] - bounds[0][1],
    x = (bounds[0][0] + bounds[1][0]) / 2,
    y = (bounds[0][1] + bounds[1][1]) / 2,
    scale = .9 / Math.max(dx / this.width, dy / this.height),
    translate = [this.width / 2 - scale * x, this.height / 2 - scale * y];

  var strokeWidth = [ 5, 1 ];
  this.mapSvg.forEach(function(d, i){
    d.transition()
      .duration(750)
      .style("stroke-width", strokeWidth[i] / scale + "px")
      .attr("transform", "translate(" + translate + ")scale(" + scale + ")");
  });

  this.change();

  // refresh navbar
  d3.select("nav").html(`
    <span onclick="reset()">台灣</span>
    <span class="city" onclick="changeNav()">${this.area}</span>`);
}

createMap.prototype.reset = function() {
  d3.selectAll(`.${this.area}`).classed("active", false);
  this.area = "台灣";

  this.mapSvg.forEach(function(d){
    d.transition()
      .duration(750)
      .style("stroke-width", "1px")
      .attr("transform", "");
  });

  this.change()

  // refresh navbar
  d3.select("nav").html('<span onclick="reset()">台灣</span>');
}

function clickedTown(){
  area = d3.select(this).attr("class").replace("active", "");
  change();

  // refresh navbar
  var tmp = area.split(" ");
  d3.select("nav").html(`
    <span onclick="reset()">台灣</span>
    <span class="city" onclick="changeNav()">${tmp[0]}</span>
    <span class="town" onclick="clickedTown()">${tmp[1]}</span>`);
}

function changeNav(){
  area = d3.select("span.city").html();
  d3.select("nav").html(`
    <span onclick="reset()">台灣</span>
    <span class="city" onclick="changeNav()">${area}</span>`);
  change();
}