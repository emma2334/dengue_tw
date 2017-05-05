d3.json("./data/city.json", function(topodata) {
  var features = topojson.feature(topodata, topodata.objects["city"]).features;
    // 這裡要注意的是 topodata.objects["city"] 中的 "city" 為原本 shp 的檔名

  var path = d3.geo.path().projection( // 路徑產生器
    d3.geo.mercator().center([121,24]).scale(6000) // 座標變換函式
  );
  d3.select("svg#map").selectAll("path").data(features).enter().append("path").attr({ id: function(d){return d.properties["C_Name"];}, d: path });
});