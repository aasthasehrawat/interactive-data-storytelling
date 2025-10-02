import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';

function App(){
  const [data,setData] = useState([]);
  const [stories,setStories] = useState([]);
  const [title,setTitle] = useState("");
  const [content,setContent] = useState("");
  const svgRef = useRef();
  const wsRef = useRef(null);

  useEffect(()=>{
    fetch("/api/data").then(r=>r.json()).then(setData);
    fetch("/api/stories").then(r=>r.json()).then(setStories);

    // connect websocket
    wsRef.current = new WebSocket("ws://localhost:5000/ws");
    wsRef.current.onmessage = (e)=> console.log("WS:", e.data);
    return ()=> wsRef.current.close();
  },[]);

  useEffect(()=>{
    if(data.length===0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const width=500, height=300;
    svg.attr("viewBox",[0,0,width,height]);
    const years = data.map(d=>d.year);
    const values = data.map(d=>d.value);
    const x = d3.scaleLinear().domain(d3.extent(years)).range([40,width-20]);
    const y = d3.scaleLinear().domain([0,d3.max(values)]).range([height-30,20]);
    const line = d3.line().x(d=>x(d.year)).y(d=>y(d.value));
    svg.append("path").datum(data).attr("d",line).attr("fill","none").attr("stroke","steelblue").attr("stroke-width",2);
    svg.append("g").attr("transform",`translate(0,${height-30})`).call(d3.axisBottom(x).ticks(years.length).tickFormat(d3.format("d")));
    svg.append("g").attr("transform","translate(40,0)").call(d3.axisLeft(y));
  },[data]);

  const saveStory = ()=>{
    fetch("/api/stories",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({title,content})
    }).then(r=>r.json()).then(s=>{
      setStories([...stories,s]);
      setTitle("");setContent("");
    });
  };

  return (
    <div style={{padding:"20px",fontFamily:"sans-serif"}}>
      <h1>Interactive Data Storytelling Hub</h1>
      <svg ref={svgRef} width="100%" height="300"></svg>
      <div>
        <h2>Stories</h2>
        {stories.map((s,i)=>(<div key={i}><strong>{s.title}</strong>: {s.content}</div>))}
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" />
        <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="Content" />
        <button onClick={saveStory}>Save</button>
      </div>
    </div>
  );
}

export default App;