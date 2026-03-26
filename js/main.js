const margin = { top: 80, right: 100, bottom: 80, left: 100 };
const width = 1800 - margin.left - margin.right;
const height = 1000 - margin.top - margin.bottom;

const svg = d3.select("#chart")
  .append("svg")
  .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
  .style("width", "100%")
  .style("height", "auto")
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#tooltip");

let currentYear = 2000;
let currentQuery = "";
let selectedGenres = new Set();

const chartGroup = svg.append("g");
const xAxisGroup = svg.append("g").attr("transform", `translate(0, ${height})`);
const yAxisGroup = svg.append("g");

// Axis labels
const xAxisLabel = svg.append("text")
    .attr("class", "x axis-label")
    .attr("x", width / 2)
    .attr("y", height + 50)
    .attr("text-anchor", "middle")
    .style("font-size", "16px");

const yAxisLabel = svg.append("text")
    .attr("class", "y axis-label")
    .attr("x", -height / 2)
    .attr("y", -60)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .style("font-size", "16px");

d3.csv("data/spotify_tracks.csv").then(data => {

  data.forEach(d => {
    d.tempo = +d.tempo;
    d.duration_ms = +d.duration_ms;
    d.duration = d.duration_ms / 1000;
    d.popularity = +d.track_popularity;
    d.year = +d.year;

    let raw = d.artist_genres
      ? d.artist_genres.replace("[","").replace("]","").split(",")[0].replace(/'/g,"").trim().toLowerCase()
      : "unknown";

    if (raw.includes("pop")) d.genre_group = "Pop";
    else if (raw.includes("rock") || raw.includes("metal")) d.genre_group = "Rock/Metal";
    else if (raw.includes("hip hop") || raw.includes("rap")) d.genre_group = "Hip-Hop/Rap";
    else if (raw.includes("r&b") || raw.includes("soul")) d.genre_group = "R&B/Soul";
    else if (raw.includes("country")) d.genre_group = "Country/Folk";
    else if (raw.includes("dance") || raw.includes("electro")) d.genre_group = "Electronic/Dance";
    else d.genre_group = "Other";
  });

  const genreGroups = ["Pop","Rock/Metal","Hip-Hop/Rap","R&B/Soul","Country/Folk","Electronic/Dance","Other"];

  const color = d3.scaleOrdinal()
    .domain(genreGroups)
    .range(d3.schemeTableau10);

  const r = d3.scalePow().exponent(2)
    .domain([0, d3.max(data,d=>d.popularity)])
    .range([10,40]);

  let xFeature = "tempo";
  let yFeature = "duration_ms";

  let x = d3.scaleLinear()
    .domain(d3.extent(data, d => +d[xFeature]))
    .range([0, width]);

  let y = d3.scaleLinear()
    .domain(d3.extent(data, d => +d[yFeature]))
    .range([height, 0]);

  xAxisGroup.call(d3.axisBottom(x));
  yAxisGroup.call(d3.axisLeft(y));
  xAxisLabel.text(capitalize(xFeature));
  yAxisLabel.text(capitalize(yFeature));

  const circles = chartGroup.selectAll("circle")
    .data(data, d => d.track_id)
    .enter()
    .append("circle")
    .attr("cx", d => x(d[xFeature]))
    .attr("cy", d => y(d[yFeature]))
    .attr("r", d => r(d.popularity))
    .style("fill", d => color(d.genre_group))
    .style("opacity", 0.7)
    .style("cursor", "pointer");

  circles
    .on("mouseover", (event,d) => {
      tooltip.style("opacity",1).html(`
        <strong>${d.track_name}</strong><br>
        ${d.artist_name}<br>
        ${d.genre_group}<br>
        ${capitalize(xFeature)}: ${d[xFeature]}<br>
        ${capitalize(yFeature)}: ${d[yFeature]}
      `);
    })
    .on("mousemove", event => {
      tooltip.style("left",(event.pageX+10)+"px")
             .style("top",(event.pageY-20)+"px");
    })
    .on("mouseout", () => tooltip.style("opacity",0))
    .on("click", function(event, d) {
      const query = encodeURIComponent(`${d.track_name} ${d.artist_name}`);
      window.open(`https://open.spotify.com/search/${query}`, "_blank");
      d3.selectAll("circle").style("stroke", "none");
      d3.select(this).style("stroke", "gold").style("stroke-width", 3);
    });

  d3.select("#xAxisSelect").on("change", function() {
    xFeature = this.value;
    updateAxes();
  });

  d3.select("#yAxisSelect").on("change", function() {
    yFeature = this.value;
    updateAxes();
  });

  function updateAxes() {
    x.domain(d3.extent(data, d => +d[xFeature]));
    y.domain(d3.extent(data, d => +d[yFeature]));

    xAxisGroup.transition().duration(500).call(d3.axisBottom(x));
    yAxisGroup.transition().duration(500).call(d3.axisLeft(y));

    xAxisLabel.text(capitalize(xFeature));
    yAxisLabel.text(capitalize(yFeature));

    update();
  }

  function updateDashboard(yearData) {
    if (yearData.length === 0) return;

    const avgTempo = d3.mean(yearData, d => d.tempo).toFixed(1);
    const avgDuration = d3.mean(yearData, d => d.duration).toFixed(0);
    const avgPopularity = d3.mean(yearData, d => d.popularity).toFixed(1);
    const topTrack = yearData.reduce((a, b) => a.popularity > b.popularity ? a : b);

    d3.select("#stat-tempo").text(avgTempo + " BPM");
    d3.select("#stat-duration").text(avgDuration + " sec");
    d3.select("#stat-popularity").text(avgPopularity);
    d3.select("#stat-song").text(topTrack.track_name);

    circles
      .attr("stroke", d => d.track_id === topTrack.track_id ? "gold" : "none")
      .attr("stroke-width", d => d.track_id === topTrack.track_id ? 3 : 0);
  }

  function update() {
    const yearData = data.filter(d => d.year === currentYear);

    circles
      .transition()
      .duration(500)
      .attr("cx", d => x(d[xFeature]))
      .attr("cy", d => y(d[yFeature]))
      .style("opacity", d => {
        const matchesYear = d.year === currentYear;
        const matchesSearch = d.track_name.toLowerCase().includes(currentQuery) ||
                              d.artist_name.toLowerCase().includes(currentQuery);

        if (!matchesYear || !matchesSearch) return 0;
        if (selectedGenres.size === 0) return 0.7;
        return selectedGenres.has(d.genre_group) ? 1 : 0.05;
      })
      .style("pointer-events", d => {
        const matchesYear = d.year === currentYear;
        const matchesSearch = d.track_name.toLowerCase().includes(currentQuery) ||
                              d.artist_name.toLowerCase().includes(currentQuery);
        return (matchesYear && matchesSearch) ? "all" : "none";
      });

    updateDashboard(yearData);
  }

  function capitalize(str){
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  update();

  d3.select("#yearSlider").on("input", function() {
    currentYear = +this.value;
    d3.select("#yearValue").text(currentYear);
    update();
  });

  d3.select("#searchBox").on("input", function() {
    currentQuery = this.value.toLowerCase();
    update();
  });

  let playing = false;
  let playInterval = null;

  d3.select("#playYears").on("click", () => {
    const button = d3.select("#playYears");

    if (!playing) {
      playing = true;
      button.text("Pause");

      let year = currentYear;
      playInterval = setInterval(() => {
        if (year > 2020 || !playing) {
          clearInterval(playInterval);
          playing = false;
          button.text("Play");
          return;
        }
        currentYear = year;
        d3.select("#yearSlider").property("value", year);
        d3.select("#yearValue").text(year);
        update();
        year++;
      }, 1200);

    } else {
      playing = false;
      button.text("Play");
      clearInterval(playInterval);
    }
  });

  const zoom = d3.zoom()
    .scaleExtent([0.5, 10])
    .on("zoom", (event) => {
      const newX = event.transform.rescaleX(x);
      const newY = event.transform.rescaleY(y);

      xAxisGroup.call(d3.axisBottom(newX));
      yAxisGroup.call(d3.axisLeft(newY));

      circles.attr("cx", d => newX(d[xFeature]))
             .attr("cy", d => newY(d[yFeature]));
    });

  svg.call(zoom);

  d3.select("#resetZoom").on("click", () => {
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
  });

  const legend = d3.select("#legend");

  genreGroups.forEach(genre => {
    const item = legend.append("div").attr("class","legend-item");
    item.append("div").attr("class","legend-color").style("background-color", color(genre));
    item.append("span").text(genre);

    item.on("click", () => {
      if (selectedGenres.has(genre)) selectedGenres.delete(genre);
      else selectedGenres.add(genre);
      update();
    });
  });

});