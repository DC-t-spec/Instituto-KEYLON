import { supabase } from "../config/supabase.js";

const state = {
  items: [],
  stock: []
};

function el(id){
  return document.getElementById(id);
}

async function loadItems(){
  const { data } = await supabase.from("inventory_items").select("*");
  state.items = data || [];

  const select = el("move-item");
  if(select){
    select.innerHTML = state.items.map(i =>
      `<option value="${i.id}">${i.name}</option>`
    ).join("");
  }
}

async function loadStock(){
  const { data } = await supabase.rpc("get_stock");

  state.stock = data || [];
  renderStock();
}

function renderStock(){
  const tbody = el("stock-body");
  if(!tbody) return;

  tbody.innerHTML = state.stock.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.stock}</td>
    </tr>
  `).join("");
}

async function createItem(e){
  e.preventDefault();

  const name = el("item-name").value;

  await supabase.from("inventory_items").insert([{ name }]);

  e.target.reset();
  await loadItems();
}

async function createMove(e){
  e.preventDefault();

  const payload = {
    item_id: el("move-item").value,
    type: el("move-type").value,
    quantity: Number(el("move-qty").value),
    reason: el("move-reason").value
  };

  await supabase.from("inventory_movements").insert([payload]);

  e.target.reset();
  await loadStock();
}

function bind(){
  el("item-form")?.addEventListener("submit", createItem);
  el("move-form")?.addEventListener("submit", createMove);
}

export async function initInventario(){
  bind();
  await loadItems();
  await loadStock();
}
