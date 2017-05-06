var svg = d3.select("svg#map");
var projection = d3.geo.mercator()
  .center([121,24])
  .scale(6000);
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

(function() {
  Promise.all([
      getCity,
      getTown
    ])
    .then(function(data) {
      var [cityFeatures, townFeatures] = data;

      svg
        .append("g")
        .selectAll("path")
        .data(cityFeatures).enter()
        .append("path").attr({
          class: "city",
          id: function(d) {
            return d.properties["C_Name"];
          },
          d: path
        });

      svg
        .append("g")
        .selectAll("path")
        .data(townFeatures).enter()
        .append("path")
        .attr({
          class: function(d) {
            return `town ${d.properties["C_Name"]}`;
          },
          id: function(d) {
            return d.properties["T_Name"];
          },
          d: path
        });
    });
})();