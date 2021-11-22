export { createMap }

// set up map data
var map = d3.select("svg#map").node().getBoundingClientRect();
var svg = d3.select("svg#map").attr('viewBox', `0 0 ${map.width} ${map.height}`);
var projection = d3.geo.mercator()
  .center([121,24])
  .scale(map.height/0.01/8.5)
  .translate([map.width / 2, map.height / 2]);
var path = d3.geo.path().projection(projection);

// set up dengue data
var rawData, fData, fData_time;
var start, end, total, tgtYear;
var area = "台灣";
var getData = new Promise(function (resolve) {
  d3.json(
    'https://emma-proxy.vercel.app/api/eic/Age_County_Gender_061.json',
    (error, data) => {
      resolve(data);
    }
  )
});

(function() {
  Promise.all([
      getData
    ])
    .then(function(data) {
      var [dataFeatures] = data;
      

      // content
      rawData = dataFeatures;
      start = d3.min(rawData, function(d){ return +d["發病年份"] });
      end = d3.max(rawData, function(d){ return +d["發病年份"] });
      tgtYear = end;
      fData_time = dataFilter(end, area);
      fData = fData_time;

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

function createMap({ city, town }) {
  // Append cities
  svg
    .append('g')
    .attr('class', 'city active')
    .selectAll('path')
    .data(city)
    .enter()
    .append('path')
    .attr({ class: d => d.properties['C_Name'], d: path })
    .on('click', clicked)
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
  svg
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
}

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
    var tmp = area.split(" ");
    return rawData.filter(function(d){
      return d["發病年份"] == year && d["縣市"] == tmp[0] && d["鄉鎮"] == tmp[1];
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
    }).entries(fData_time);

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
    }).entries(fData_time);

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
  var monthCount = monthNest(fData);

  var svg = d3.select("#month svg");
  var width = svg.node().getBoundingClientRect().width - 80;
  var height = svg.node().getBoundingClientRect().height - 80;
  // axis
  var x = d3.scale.linear().range([0, width]);
  var y = d3.scale.linear().range([height, 0]);
  var xAxis = d3.svg.axis().scale(x).orient("bottom");
  var yAxis = d3.svg.axis().scale(y).orient("left");

  x.domain([1, 12]);
  y.domain([0, d3.max(monthCount, function(d) { return d.values; })]).nice();

  svg.append("g")
    .attr("class", "x axis")
    .attr("transform", `translate(40,${height+40})`)
    .call(xAxis);

  svg.append("g")
    .attr("class", "y axis")
    .attr("transform", "translate(40,40)")
    .call(yAxis)
    .append("text")
    .attr({
      x: -10,
      y: y(y.ticks().pop()) -10,
      dy: "-0.32em",
    })
    .text("人數");

  // line
  svg.datum(monthCount);
  var line = d3.svg.line()
    .interpolate("linear")
    .x(function(d) { return x(d.key); })
    .y(function(d) { return y(d.values); });

  svg.append("path")
    .attr("class", "line")
    .attr("d", line)
    .attr("transform", "translate(40,40)");

  svg.append("g").attr({
    class: "point",
    transform: "translate(40,40)"
  });

  svg.select("g.point").selectAll("g")
    .data(monthCount)
    .enter()
    .append("circle")
    .attr({
      cx: function(d){
        return x(d.key)
      },
      cy: function(d){
        return y(d.values)
      },
      r: 4,
      fill: "red"
    })
    .on("mouseover", function(d){
      d3.select("#tooltip")
        .html(`${d.values}人`)
        .style({
          left: `${d3.event.pageX}px`,
          top: `${d3.event.pageY}px`
        });
      d3.select("#tooltip").classed("hidden", false);
    })
    .on("mouseout", function(d){
      d3.select("#tooltip").classed("hidden", true);
    });
}

function monthNest(data){
  var tmp = [];
  for(var i=1; i<13; i++){
    tmp.push({ key: i, values: 0 });
  }
  if(data.length != 0){
    var monthCount = d3.nest()
      .key(function(d){ return d["發病月份"] })
      .rollup(function(d){
        var count = 0;
        for(var i=0; i<d.length; i++){
          count += +d[i]["確定病例數"];
        }
        return count;
      }).entries(data);

    monthCount.forEach(function(d){
      tmp[+d.key-1].values = d.values;
    });
  }
  return tmp;
}

function drawAgeChart(){
  var ageDomain = ["0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64", "65-69", "70+"];
  var ageCount = ageNest(fData, ageDomain);

  var svg = d3.select("#age svg");
  var width = svg.node().getBoundingClientRect().width - 80;
  var height = svg.node().getBoundingClientRect().height - 80;

  // scale
  var x0 = d3.scale
    .ordinal()
    .domain(ageDomain)
    .rangeBands([0, width],0.15);
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
      .attr("fill", function(d) { return color[d.key]; })
      .on("mouseover", function(d){
        d3.select("#tooltip")
          .html(`${d.values}人`)
          .style({
            left: `${d3.event.pageX}px`,
            top: `${d3.event.pageY}px`
          });
        d3.select("#tooltip").classed("hidden", false);
      })
      .on("mouseout", function(d){
        d3.select("#tooltip").classed("hidden", true);
      });

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
    .call(yAxis)
    .append("text")
    .attr({
      x: -10,
      y: y(y.ticks().pop()) -10,
      dy: "-0.32em",
    })
    .text("人數");
}

function ageNest(d, domain){
  var tmp = [];

  if(d.length == 0){
    for(var i=0; i<domain.length; i++){
      tmp.push({ key: domain[i], values: 0 });
    }
    return tmp;
  }else{
    var ageCount = d3.nest()
      .key(function(d){ return d["年齡層"] })
      .key(function(d){ return d["性別"] })
      .rollup(function(d){
        var count = 0;
        for(var i=0; i<d.length; i++){
          count += +d[i]["確定病例數"];
        }
        return count;
      }).entries(d);

    // adjust data
    ageCount.push({
      key: "0-4",
      values: [{ key: "M", values: 0 } ,{ key: "F", values: 0 }]
    });

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

    return ageCount;
  }
}

function drawAbroadChart(){
  var svg = d3.select("#abroad svg");
  var width = svg.node().getBoundingClientRect().width;
  var height = svg.node().getBoundingClientRect().height;

  if(fData && fData.length == 0){
    svg.append("text")
      .attr({
        transform: `translate(${width/2},${height/2})`,
        "font-size": 40,
        "text-anchor": "middle"
      })
      .text("無");
    return ;
  }

  var abroadCount = d3.nest()
    .key(function(d){ return d["是否為境外移入"] })
    .rollup(function(d){
      var count = 0;
      for(var i=0; i<d.length; i++){
        count += +d[i]["確定病例數"];
      }
      return count;
    }).entries(fData);

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
    })
    .on("mouseover", function(d){
      d3.select("#tooltip")
        .html(`${d.value}人`)
        .style({
          left: `${d3.event.pageX}px`,
          top: `${d3.event.pageY}px`
        });
      d3.select("#tooltip").classed("hidden", false);
    }).on("mouseout", function(d){
      d3.select("#tooltip").classed("hidden", true);
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

  total = totalNum(fData);
  d3.select("span.total").html(total);
  d3.select("span.area").html(area.split(" ").join(""));

  d3.selectAll(".content svg").html("");
  drawMonthChart();
  drawAgeChart();
  drawAbroadChart();
}

function totalNum(data){
  if(fData.length == 0){
    return 0;
  }else{
    var count = d3.nest()
      .key(function(d){ return d["確定病名"] })
      .rollup(function(d){
        var count = 0;
        for(var i=0; i<d.length; i++){
          count += +d[i]["確定病例數"];
        }
        return count;
      }).entries(data);
    return count[0].values;
  }
}

function changeYear(){
  tgtYear = d3.select("#year").property("value");
  fData_time = dataFilter(tgtYear, "台灣");
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

  var strokeWidth = [ 5, 1 ];
  mapSvg.forEach(function(d, i){
    d.transition()
      .duration(750)
      .style("stroke-width", strokeWidth[i] / scale + "px")
      .attr("transform", "translate(" + translate + ")scale(" + scale + ")");
  });

  change();

  // refresh navbar
  d3.select("nav").html(`
    <span onclick="reset()">台灣</span>
    <span class="city" onclick="changeNav()">${area}</span>`);
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

  // refresh navbar
  var tmp = area.split(" ");
  d3.select("nav").html('<span onclick="reset()">台灣</span>');
}

d3.select("#map rect.background").on("click", reset);

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