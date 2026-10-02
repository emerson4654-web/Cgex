const logs=[];
const reviews=[];
const transcripts=[];

document.getElementById("logCount").textContent=logs.length;
document.getElementById("reviewCount").textContent=reviews.length;

function render(id,data,empty){
  const el=document.getElementById(id);
  if(!data.length){el.textContent=empty;return;}
  el.innerHTML=data.map(item=>`<div class="entry">${item}</div>`).join("");
}
render("logsList",logs,"Nenhum log registrado.");
render("reviewsList",reviews,"Nenhuma avaliação registrada.");
render("transcriptsList",transcripts,"Nenhum transcript registrado.");
