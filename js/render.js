export { paintMap, drawMonthChart, drawAgeChart, drawAbroadChart }

function paintMap(data) {
  // Clear scaled color
  d3.selectAll('svg#map path').attr({ fill: '#fff' })

  // Generate color scale
  const color = d3.scale.linear().domain([0, 10]).range(['#E4E4E4', '#B50C0C'])

  // Group data by city
  const cityCount = d3
    .nest()
    .key(d => d['縣市'])
    .rollup(d => d3.sum(d, dd => dd['確定病例數']))
    .entries(data)

  const max = d3.max(cityCount, d => d.values)
  const scale = d3.scale.linear().domain([1, max]).range([0, 20])

  // Paint
  cityCount.forEach(e => {
    d3.select('.' + e.key).attr({ fill: color(scale(e.values)) })
  })

  // Group data by town
  const townCount = d3
    .nest()
    .key(d => d['縣市'])
    .key(d => d['鄉鎮'].replace(/\s/g, ''))
    .rollup(d => d3.sum(d, dd => dd['確定病例數']))
    .entries(data)

  // Paint
  townCount.forEach(city => {
    city.values.forEach(town => {
      d3.select(`.${city.key}.${town.key}`).attr({
        fill: color(scale(town.values)),
      })
    })
  })
}

function drawMonthChart(data) {
  // Sort data and make sure months without data have default values
  const monthCount = Array(12)
    .fill()
    .map((e, i) => ({ key: i + 1, values: 0 }))
  d3.nest()
    .key(d => d['發病月份'])
    .rollup(d => d3.sum(d, dd => dd['確定病例數']))
    .entries(data)
    .forEach(e => {
      monthCount[e.key - 1].values = e.values
    })

  // Draw chart
  const svg = d3.select('#month svg')
  const width = svg.node().getBoundingClientRect().width - 80
  const height = svg.node().getBoundingClientRect().height - 80
  // axis
  const x = d3.scale.linear().range([0, width])
  const y = d3.scale.linear().range([height, 0])
  const xAxis = d3.svg.axis().scale(x).orient('bottom')
  const yAxis = d3.svg.axis().scale(y).orient('left')

  x.domain([1, 12])
  y.domain([0, d3.max(monthCount, d => d.values)]).nice()

  svg
    .append('g')
    .attr('class', 'x axis')
    .attr('transform', `translate(40,${height + 40})`)
    .call(xAxis)

  svg
    .append('g')
    .attr('class', 'y axis')
    .attr('transform', 'translate(40,40)')
    .call(yAxis)
    .append('text')
    .attr({ x: -10, y: -10, dy: '-0.32em' })
    .text('人數')

  // line
  svg.datum(monthCount)
  const line = d3.svg
    .line()
    .interpolate('linear')
    .x(d => x(d.key))
    .y(d => y(d.values))

  svg
    .append('path')
    .attr('class', 'line')
    .attr('d', line)
    .attr('transform', 'translate(40,40)')

  svg.append('g').attr({
    class: 'point',
    transform: 'translate(40,40)',
  })

  svg
    .select('g.point')
    .selectAll('g')
    .data(monthCount)
    .enter()
    .append('circle')
    .attr({
      cx: d => x(d.key),
      cy: d => y(d.values),
      r: 4,
      fill: 'red',
    })
    .on('mouseover', d => {
      d3.select('#tooltip')
        .html(`${d.values}人`)
        .style({
          left: `${d3.event.pageX}px`,
          top: `${d3.event.pageY}px`,
        })
      d3.select('#tooltip').classed('hidden', false)
    })
    .on('mouseout', d => {
      d3.select('#tooltip').classed('hidden', true)
    })
}

function drawAgeChart(data) {
  const ageDomain = [
    '0-4',
    '5-9',
    '10-14',
    '15-19',
    '20-24',
    '25-29',
    '30-34',
    '35-39',
    '40-44',
    '45-49',
    '50-54',
    '55-59',
    '60-64',
    '65-69',
    '70+',
  ]

  // Sort data by age and gender
  const ageCount = d3
    .nest()
    .key(d => d['年齡層'])
    .key(d => d['性別'])
    .rollup(d => d3.sum(d, dd => dd['確定病例數']))
    .entries(data)
    .reduce(
      (pre, cur) => {
        if (cur.key < 5) {
          cur.values.forEach(e => {
            pre[0].values[e.key === 'M' ? 0 : 1].values += e.values
          })
        } else {
          pre.push(cur)
        }
        return pre
      },
      [
        {
          key: '0-4',
          values: [
            { key: 'M', values: 0 },
            { key: 'F', values: 0 },
          ],
        },
      ]
    )

  const svg = d3.select('#age svg')
  const width = svg.node().getBoundingClientRect().width - 80
  const height = svg.node().getBoundingClientRect().height - 80

  // scale
  const x0 = d3.scale.ordinal().domain(ageDomain).rangeBands([0, width], 0.15)
  const x1 = d3.scale
    .ordinal()
    .domain(['M', 'F'])
    .rangeBands([0, x0.rangeBand()], 0)
  const y = d3.scale.linear().range([height, 0])
  y.domain([0, d3.max(ageCount, d => d3.max(d.values, c => c.values))]).nice()

  // bar
  const color = { M: 'dodgerblue', F: 'deeppink' }
  svg
    .append('g')
    .attr({
      class: 'bar',
      transform: 'translate(40,40)',
    })
    .selectAll('g')
    .data(ageCount)
    .enter()
    .append('g')
    .attr('transform', d => 'translate(' + x0(d.key) + ',0)')
    .selectAll('rect')
    .data(d => d.values)
    .enter()
    .append('rect')
    .attr('x', d => x1(d.key))
    .attr('y', d => y(d.values))
    .attr('width', x1.rangeBand())
    .attr('height', d => height - y(d.values))
    .attr('fill', d => color[d.key])
    .on('mouseover', d => {
      d3.select('#tooltip')
        .html(`${d.values}人`)
        .style({ left: `${d3.event.pageX}px`, top: `${d3.event.pageY}px` })
      d3.select('#tooltip').classed('hidden', false)
    })
    .on('mouseout', function (d) {
      d3.select('#tooltip').classed('hidden', true)
    })

  // axis
  const xAxis = d3.svg.axis().scale(x0).orient('bottom')
  const yAxis = d3.svg.axis().scale(y).ticks(5).orient('left')

  svg
    .append('g')
    .attr({
      class: 'axis x',
      transform: `translate(40,${height + 40})`,
    })
    .call(xAxis)

  svg
    .append('g')
    .attr({
      class: 'axis y',
      transform: 'translate(40,40)',
    })
    .call(yAxis)
    .append('text')
    .attr({ x: -10, y: -10, dy: '-0.32em' })
    .text('人數')
}

function drawAbroadChart(data) {
  const svg = d3.select('#abroad svg')
  const width = svg.node().getBoundingClientRect().width
  const height = svg.node().getBoundingClientRect().height

  if (data.length == 0) {
    svg
      .append('text')
      .attr({
        transform: `translate(${width / 2},${height / 2})`,
        'font-size': 40,
        'text-anchor': 'middle',
      })
      .text('無')
    return
  }

  const abroadCount = d3
    .nest()
    .key(d => d['是否為境外移入'])
    .rollup(d => d3.sum(d, dd => dd['確定病例數']))
    .entries(data)

  // bind
  const pie = d3.layout
    .pie()
    .sort(null)
    .value(d => d.values)
  const sel = svg.selectAll('g.arc').data(pie(abroadCount))
  const g_arc = sel
    .enter()
    .append('g')
    .attr('class', 'arc')
    .attr('transform', `translate(${width / 2},${height / 2})`)
  g_arc.append('path')
  g_arc.append('text')
  sel.exit().remove()

  // render
  const radius = d3.min([width, height])
  const arc = d3.svg
    .arc()
    .outerRadius(radius / 2 - 20)
    .innerRadius(0)

  const color = d3.scale.category20()
  svg
    .selectAll('g.arc')
    .select('path')
    .attr({
      d: arc,
      fill: (d, i) => color(i),
    })
    .on('mouseover', function (d) {
      d3.select('#tooltip')
        .html(`${d.value}人`)
        .style({
          left: `${d3.event.pageX}px`,
          top: `${d3.event.pageY}px`,
        })
      d3.select('#tooltip').classed('hidden', false)
    })
    .on('mouseout', function (d) {
      d3.select('#tooltip').classed('hidden', true)
    })

  const total = d3
    .nest()
    .rollup(d => d3.sum(d, dd => dd['確定病例數']))
    .entries(data)
  svg
    .selectAll('g.arc')
    .select('text')
    .attr({
      transform: d => `translate(${arc.centroid(d)})`,
      'text-anchor': 'middle',
    })
    .text(d => `${d.data.key} ${((d.data.values / total) * 100).toFixed(1)}%`)
}
