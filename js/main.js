const margin = { top: 100, right: 200, bottom: 100, left: 120 };
const width = 1800 - margin.left - margin.right;
const height = 1000 - margin.top - margin.bottom;

const svg = d3.select("#chart")
  .append("svg")
  .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
  .style("max-width", "100%")
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#tooltip");

let currentYear = 2000;
let currentQuery = "";
let selectedGenres = new Set();

const chartGroup = svg.append("g");

const xAxisGroup = svg.append("g")
  .attr("class", "x-axis")
  .attr("transform", `translate(0, ${height})`);

const yAxisGroup = svg.append("g")
  .attr("class", "y-axis");

d3.csv("data/spotify_tracks.csv").then(data => {

  data.forEach(d => {
    d.tempo = +d.tempo;
    d.duration = +d.duration_ms / 1000;
    d.popularity = +d.track_popularity;
    d.year = +d.year;

    let raw = d.artist_genres
      ? d.artist_genres.replace("[","").replace("]","").split(",")[0].replace(/'/g,"").trim().toLowerCase()
      : "unknown";

    if (raw.includes("pop") || raw.includes("boy band") || raw.includes("bubblegum")) d.genre_group = "Pop";
    else if (raw.includes("rock") || raw.includes("metal")) d.genre_group = "Rock/Metal";
    else if (raw.includes("hip hop") || raw.includes("rap") || raw.includes("g funk") || raw.includes("crunk")) d.genre_group = "Hip-Hop/Rap";
    else if (raw.includes("r&b") || raw.includes("soul")) d.genre_group = "R&B/Soul";
    else if (raw.includes("country") || raw.includes("celtic")) d.genre_group = "Country/Folk";
    else if (raw.includes("dance") || raw.includes("electro") || raw.includes("house") || raw.includes("trance") || raw.includes("electronica")) d.genre_group = "Electronic/Dance";
    else d.genre_group = "Other";
  });

  const genreGroups = ["Pop","Rock/Metal","Hip-Hop/Rap","R&B/Soul","Country/Folk","Electronic/Dance","Other"];

  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.tempo))
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([d3.min(data,d=>d.duration), Math.min(500,d3.max(data,d=>d.duration))])
    .range([height, 0]);

  const r = d3.scaleLinear()
    .domain([0, d3.max(data,d=>d.popularity)])
    .range([4,20]);

  const color = d3.scaleOrdinal()
    .domain(genreGroups)
    .range(d3.schemeTableau10);

  xAxisGroup.call(d3.axisBottom(x).ticks(12));
  yAxisGroup.call(d3.axisLeft(y).ticks(10));

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 65)
    .attr("text-anchor","middle")
    .style("font-size","18px")
    .text("Tempo (BPM)");

  svg.append("text")
    .attr("transform","rotate(-90)")
    .attr("x",-height/2)
    .attr("y",-90)
    .attr("text-anchor","middle")
    .style("font-size","18px")
    .text("Duration (seconds)");

  const circles = chartGroup.selectAll("circle")
    .data(data, d => d.track_id)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.tempo))
    .attr("cy", d => y(d.duration))
    .attr("r", d => r(d.popularity))
    .style("fill", d => color(d.genre_group))
    .style("opacity", 0.7);

  circles.on("mouseover", (event,d) => {
      tooltip.style("opacity",1).html(`
        <strong>${d.track_name}</strong><br>
        ${d.artist_name}<br>
        Genre: ${d.genre_group}<br>
        Tempo: ${d.tempo}<br>
        Duration: ${Math.round(d.duration)} sec<br>
        Popularity: ${d.popularity}
      `);
    })
    .on("mousemove", event => {
      tooltip
        .style("left",(event.pageX+10)+"px")
        .style("top",(event.pageY-20)+"px");
    })
    .on("mouseout", () => tooltip.style("opacity",0));

    
function update() {
  circles
    .transition()
    .duration(600)
    .style("opacity", d => {
      const matchesYear = d.year === currentYear;
      const matchesSearch = d.track_name.toLowerCase().includes(currentQuery) || d.artist_name.toLowerCase().includes(currentQuery);

      if (!matchesYear || !matchesSearch) return 0;
      if (selectedGenres.size === 0) return 0.75;
      return selectedGenres.has(d.genre_group) ? 1 : 0.1;
    })
    .style("pointer-events", d => {
      const matchesYear = d.year === currentYear;
      const matchesSearch = d.track_name.toLowerCase().includes(currentQuery) || d.artist_name.toLowerCase().includes(currentQuery);

      if (!matchesYear || !matchesSearch) return "none"; // 👈 KEY FIX
      return "all";
    });
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

  const legend = svg.selectAll(".legend")
    .data(genreGroups)
    .enter()
    .append("g")
    .attr("class","legend")
    .attr("transform",(d,i)=>`translate(${width+30},${i*30})`)
    .style("cursor","pointer")
    .on("click", function(event,d){
      if(selectedGenres.has(d)) selectedGenres.delete(d);
      else selectedGenres.add(d);

      legend.selectAll("rect")
        .style("opacity", g => (selectedGenres.size===0 || selectedGenres.has(g))?1:0.3);

      update();
    });

  legend.append("rect")
    .attr("width",18)
    .attr("height",18)
    .attr("fill", d => color(d));

  legend.append("text")
    .attr("x",25)
    .attr("y",14)
    .text(d=>d)
    .style("font-size","15px");

  const zoom = d3.zoom()
    .scaleExtent([0.5, 10])
    .translateExtent([[0, 0], [width, height]])
    .extent([[0, 0], [width, height]])
    .on("zoom", zoomed);

  svg.call(zoom);

  function zoomed(event) {
    const transform = event.transform;

    const newX = transform.rescaleX(x);
    const newY = transform.rescaleY(y);

    xAxisGroup.call(d3.axisBottom(newX));
    yAxisGroup.call(d3.axisLeft(newY));

    circles
      .attr("cx", d => newX(d.tempo))
      .attr("cy", d => newY(d.duration));
  }

  d3.select("#resetZoom").on("click", () => {
    svg.transition().duration(750).call(
      zoom.transform,
      d3.zoomIdentity
    );
  });

});