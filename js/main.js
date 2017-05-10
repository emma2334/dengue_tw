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
var rawData, fData;
var start, end;
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

      svg
        .append("g")
        .attr("class", "city active")
        .selectAll("path")
        .data(cityFeatures).enter()
        .append("path").attr({
          id: function(d) {
            return d.properties["C_Name"];
          },
          d: path
        });

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

      rawData = dataFeatures;
      start = d3.min(rawData, function(d){ return d["發病年份"] });
      end = d3.max(rawData, function(d){ return d["發病年份"] });
      fData = yearFilter(end);
      colorMap();
    });
})();

function yearFilter(year){
  return rawData.filter(function(d){
    return d["發病年份"] == year;
  });
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
  var scale = d3.scale.linear().domain([0, max]).range([0, 20]);

  for(var i=0; i<cityCount.length; i++){
    d3.select("#" + cityCount[i].key).attr({
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
  scale = d3.scale.linear().domain([0, max]).range([0, 20]);

  for(var i=0; i<townCount.length; i++){
    var tgt = townCount[i].values;
    for(var j=0; j<tgt.length; j++){
      d3.select(`.${townCount[i].key}.${tgt[j].key}`).attr({
        fill: color(scale(tgt[j].values))
      });
    }
  }
}