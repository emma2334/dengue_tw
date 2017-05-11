// set up map data
var map = d3.select("svg#map").node().getBoundingClientRect();
var svg = d3.select("svg#map").attr('viewBox', `0 0 ${map.width} ${map.height}`);
var projection = d3.geo.mercator()
  .center([121,24])
  .scale(map.height/0.01/8.5)
  .translate([map.width / 2, map.height / 2]);
var path = d3.geo.path().projection(projection);

var getCity = new Promise(function(resolve) {
  d3.json("./data/city.json", function(topodata) {
    resolve(topojson.feature(topodata, topodata.objects["city"]).features);
  });
});

var getTown = new Promise(function(resolve) {
  d3.json("./data/town.json", function(topodata) {
    resolve(topojson.feature(topodata, topodata.objects["town"]).features);
  });
});

// set up dengue data
var rawData, fData, fData_time;
var start, end, total, tgtYear;
var area = "台灣";
var getData = new Promise(function(resolve) {
  csv = d3.dsv(",", "text/csv;charset=big5");
  csv("https://nidss.cdc.gov.tw/Download/Age_County_Gender_061.csv", function(data){
    resolve(data);
  });
});

(function() {
  Promise.all([
      getCity,
      getTown,
      getData
    ])
    .then(function(data) {
      var [cityFeatures, townFeatures, dataFeatures] = data;

      // map
      svg
        .append("g")
        .attr("class", "city active")
        .selectAll("path")
        .data(cityFeatures).enter()
        .append("path").attr({
          class: function(d) {
            return d.properties["C_Name"];
          },
          d: path
        })
        .on("click", clicked);

      svg
        .append("g")
        .attr("class", "town")
        .selectAll("path")
        .data(townFeatures).enter()
        .append("path")
        .attr({
          class: function(d) {
            return `${d.properties["C_Name"]} ${d.properties["T_Name"]}`;
          },
          d: path
        });

      // content
      rawData = dataFeatures;
      start = d3.min(rawData, function(d){ return +d["發病年份"] });
      end = d3.max(rawData, function(d){ return +d["發病年份"] });
      tgtYear = end;
      fData = dataFilter(end, area);

      for(var i=end; i>=start; i--){
        d3.select("#year").append("option").attr({ value: i }).html(i);
      }
      var count = d3.nest()
        .key(function(d){ return d["確定病名"] })
        .rollup(function(d){
          var count = 0;
          for(var i=0; i<d.length; i++){
            count += +d[i]["確定病例數"];
          }
          return count;
        }).entries(fData);
        total = count[0].values;
        d3.select("span.total").html(total);

      // render svg
      colorMap();
      drawMonthChart();
      drawAgeChart();
      drawAbroadChart();

      // data for zoom map
      mapSvg = [ d3.select("#map g.city"), d3.select("#map g.town")];
    });
})();

function dataFilter(year, area){
  if(area === "台灣"){
    return rawData.filter(function(d){
      return d["發病年份"] == year;
    });
  }else if(area.split(" ").length==1){
    return rawData.filter(function(d){
      return d["發病年份"] == year && d["縣市"] == area;
    });
  }else{
    return rawData.filter(function(d){
      var tmp = area.split(" ");
      area = tmp[1];
      return d["發病年份"] == year && d["縣市"] == tmp[0] && d["縣市"] == tmp[1];
    });
  }
}

function colorMap(){
  // color scale
  var color = d3.scale
    .linear()
    .domain([0,10])
    .range(["#E4E4E4", "#B50C0C"]);

  // city
  var cityCount = d3.nest()
    .key(function(d){ return d["縣市"] })
    .rollup(function(d){
      var count = 0;
      for(var i=0; i<d.length; i++){
        count += +d[i]["確定病例數"];
      }
      return count;
    }).entries(fData);

  var max = d3.max(cityCount, function(d){ return d.values });
  var scale = d3.scale.linear().domain([1, max]).range([0, 20]);

  for(var i=0; i<cityCount.length; i++){
    d3.select("." + cityCount[i].key).attr({
      fill: color(scale(cityCount[i].values))
    });
  }

  // town
  var townCount = d3.nest()
    .key(function(d){ return d["縣市"] })
    .key(function(d){ return d["鄉鎮"] })
    .rollup(function(d){
      var count = 0;
      for(var i=0; i<d.length; i++){
        count += +d[i]["確定病例數"];
      }
      return count;
    }).entries(fData);

  max = d3.max(townCount, function(d){
    return d3.max(d.values, function(c){ return c.values });
  });
  scale = d3.scale.linear().domain([1, max]).range([0, 20]);

  for(var i=0; i<townCount.length; i++){
    var tgt = townCount[i].values;
    for(var j=0; j<tgt.length; j++){
      d3.select(`.${townCount[i].key}.${tgt[j].key}`).attr({
        fill: color(scale(tgt[j].values))
      });
    }
  }
}

function drawMonthChart(){
  var monthCount = d3.nest()
    .key(function(d){ return d["發病月份"] })
    .rollup(function(d){
      var count = 0;
      for(var i=0; i<d.length; i++){
        count += +d[i]["確定病例數"];
      }
      return count;
    }).entries(fData);

  var svg = d3.select("#month svg");
  var width = svg.node().getBoundingClientRect().width - 80;
  var height = svg.node().getBoundingClientRect().height - 80;
  // axis
  var x = d3.scale.linear().range([0, width]);
  var y = d3.scale.linear().range([height, 0]);
  var xAxis = d3.svg.axis().scale(x).orient("bottom");
  var yAxis = d3.svg.axis().scale(y).orient("left");

  x.domain([0, 12]);
  y.domain([0, d3.max(monthCount, function(d) { return d.values; })]).nice();

  svg.append("g")
    .attr("class", "x axis")
    .attr("transform", `translate(40,${height+40})`)
    .call(xAxis);

  svg.append("g")
    .attr("class", "y axis")
    .attr("transform", "translate(40,40)")
    .call(yAxis);

  // line
  svg.datum(monthCount);
  var line = d3.svg.line()
    .interpolate("monotone")
    .x(function(d) { return x(d.key); })
    .y(function(d) { return y(d.values); });

  svg.append("path")
    .attr("class", "line")
    .attr("d", line)
    .attr("transform", "translate(40,40)");

  svg.append("g").attr({ class: "point" }).attr("transform", "translate(40,40)");
  for(var i=0; i<monthCount.length; i++){
    svg.select("g.point").append("circle")
      .attr({
        cx: x(monthCount[i].key),
        cy: y(monthCount[i].values),
        r: 4,
        fill: "red"
      });
    svg.select("g.point").append("text")
      .attr({
        x: x(monthCount[i].key),
        y: y(monthCount[i].values),
        "font-size": 12
      })
      .text(monthCount[i].values)
      .attr("transform", "translate(-5,-10)");
  }
}

function drawAgeChart(){
  var ageDomain = ["0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64", "65-69", "70+"];
  var ageCount = d3.nest()
    .key(function(d){ return d["年齡層"] })
    .key(function(d){ return d["性別"] })
    .rollup(function(d){
      var count = 0;
      for(var i=0; i<d.length; i++){
        count += +d[i]["確定病例數"];
      }
      return count;
    }).entries(fData);

  ageCount.push({
    key: "0-4",
    values: [{ key: "M", values: 0 } ,{ key: "F", values: 0 }]
  });

  // adjust data
  var tmp = [];
  for(var i=0; i<(ageCount.length-1); i++){
    if(Number.isInteger(+ageCount[i].key)){
      ageCount[i].values.forEach(function(d){
        if(d.key ==="M") ageCount[ageCount.length-1].values[0].values += +d.values;
        else ageCount[ageCount.length-1].values[1].values += +d.values;
      });
      tmp.push(i);
    }
  }
  while(tmp.length>0){
    ageCount.splice(tmp.pop(), 1);
  }

  var svg = d3.select("#age svg");
  var width = svg.node().getBoundingClientRect().width - 80;
  var height = svg.node().getBoundingClientRect().height - 80;

  // scale
  var x0 = d3.scale
    .ordinal()
    .domain(ageDomain)
    .rangeBands([0, width],0.1);
  var x1 = d3.scale
    .ordinal()
    .domain(["M", "F"])
    .rangeBands([0, x0.rangeBand()], 0);
  var y = d3.scale.linear().range([height, 0]);
  y.domain([0, d3.max(ageCount, function(d) {
      return d3.max(d.values, function(c){ return c.values });
    })]).nice();

  // bar
  var color = { M: "dodgerblue", F: "deeppink" }
  svg.append("g").attr({
    class: "bar",
    transform: "translate(40,40)"
  }).selectAll("g")
    .data(ageCount)
    .enter().append("g")
      .attr("transform", function(d) { return "translate(" + x0(d.key) + ",0)"; })
    .selectAll("rect")
    .data(function(d) { return d.values; })
    .enter().append("rect")
      .attr("x", function(d) { return x1(d.key); })
      .attr("y", function(d) { return y(d.values); })
      .attr("width", x1.rangeBand())
      .attr("height", function(d) { return height - y(d.values); })
      .attr("fill", function(d) { return color[d.key]; });

  // axis
  var xAxis = d3.svg.axis().scale(x0).orient("bottom");
  var yAxis = d3.svg.axis().scale(y).ticks(5).orient("left");

  svg.append("g")
    .attr({
      class: "axis x",
      transform: `translate(40,${height+40})`
    })
    .call(xAxis);

  svg.append("g")
    .attr({
      class: "axis y",
      transform: "translate(40,40)"
    })
    .call(yAxis);
}

function drawAbroadChart(){
  var abroadCount = d3.nest()
    .key(function(d){ return d["是否為境外移入"] })
    .rollup(function(d){
      var count = 0;
      for(var i=0; i<d.length; i++){
        count += +d[i]["確定病例數"];
      }
      return count;
    }).entries(fData);

  var svg = d3.select("#abroad svg");
  var width = svg.node().getBoundingClientRect().width;
  var height = svg.node().getBoundingClientRect().height;

  // bind
  var pie = d3.layout.pie()
    .sort(null)
    .value(function(d) { return d.values; });
  var sel = svg.selectAll("g.arc").data(pie(abroadCount));
  var g_arc = sel.enter()
    .append("g")
    .attr("class","arc")
    .attr("transform", `translate(${width/2},${height/2})`);
  g_arc.append("path");
  g_arc.append("text");
  sel.exit().remove();;

  // render
  var radius = d3.min([width, height]);
  var arc = d3.svg.arc()
    .outerRadius(radius/2-20)
    .innerRadius(0);

  var color = d3.scale.category20();
  svg.selectAll("g.arc").select("path").attr({
    d: arc,
    fill: function(d, i){
      return color(i);
    }
  });

  var total = 0;
  abroadCount.forEach(function(d){
    total += d.values;
  });

  svg.selectAll("g.arc")
    .select("text")
    .attr({
      transform: function(d){
        return `translate(${arc.centroid(d)})`;
      },
      "text-anchor": "middle"
    })
    .text(function(d) {
      return `${d.data.key} ${((d.data.values/total)*100).toFixed(1)}%`;
    });
}

function change(){
  fData = dataFilter(tgtYear, area);
  var count = d3.nest()
    .key(function(d){ return d["確定病名"] })
    .rollup(function(d){
      var count = 0;
      for(var i=0; i<d.length; i++){
        count += +d[i]["確定病例數"];
      }
      return count;
    }).entries(fData);
  total = count[0].values;
  d3.select("span.total").html(total);
  d3.select("span.area").html(area);

  d3.selectAll(".content svg").html("");
  drawMonthChart();
  drawAgeChart();
  drawAbroadChart();
}

function changeYear(){
  var e = document.getElementById("year")
  tgtYear = e.options[e.selectedIndex].text;
  fData = dataFilter(tgtYear, area);
  change();
  colorMap();
}

// zoom map
var mapSvg;
var active = d3.select(null);
var mapWidth = d3.select("#map").node().getBoundingClientRect().width;
var mapHeight = d3.select("#map").node().getBoundingClientRect().height;

function clicked(d) {
  // if (active.node() === this) return reset();
  active.classed("active", false);

  // show town map
  if(active.node() != null){
    var className = active.attr("class");
    d3.selectAll(`.${className}`).classed("active", false);
  }
  active = d3.select(this);
  className = active.attr("class");
  area = className;
  d3.selectAll(`.${className}`).classed("active", true);

  active = active.classed("active", true);

  var bounds = path.bounds(d),
    dx = bounds[1][0] - bounds[0][0],
    dy = bounds[1][1] - bounds[0][1],
    x = (bounds[0][0] + bounds[1][0]) / 2,
    y = (bounds[0][1] + bounds[1][1]) / 2,
    scale = .9 / Math.max(dx / mapWidth, dy / mapHeight),
    translate = [mapWidth / 2 - scale * x, mapHeight / 2 - scale * y];

  mapSvg.forEach(function(d){
    d.transition()
      .duration(750)
      .style("stroke-width", 1 / scale + "px")
      .attr("transform", "translate(" + translate + ")scale(" + scale + ")");
  });

  change();
}

function reset() {
  area = "台灣";
  active.classed("active", false);

  if(active.node() != null){
    var className = active.attr("class");
    d3.selectAll(`.${className}`).classed("active", false);
  }

  active = d3.select(null);

  mapSvg.forEach(function(d){
    d.transition()
      .duration(750)
      .style("stroke-width", "1px")
      .attr("transform", "");
  });

  change();
}

d3.select("#map rect.background").on("click", reset);