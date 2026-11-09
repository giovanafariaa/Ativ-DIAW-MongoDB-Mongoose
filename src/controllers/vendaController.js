import mongoose from 'mongoose';
import Produto from '../models/Produto.js';
import Venda from '../models/Venda.js';

const arredondar = (n) => Math.round(n * 100) / 100;

const erro = (res, e) => {
  if (e.name === 'ValidationError' || e.name === 'CastError') return res.status(400).json({ erro: e.message });
  console.error(e);
  return res.status(500).json({ erro: 'Erro interno' });
};

const POPULATE = { path: 'itens.produto', select: 'nome categoria preco fabricante' };

export async function criar(req, res) {
  try {
    const { cliente, data, itens } = req.body ?? {};

    if (!cliente?.nome || typeof cliente.nome !== 'string' || !cliente.nome.trim())
      return res.status(400).json({ erro: 'cliente.nome é obrigatório' });
    if (!Array.isArray(itens) || itens.length === 0)
      return res.status(400).json({ erro: 'Informe ao menos um item em "itens"' });

    // Valida itens e agrupa produtos repetidos somando as quantidades
    const quantidades = new Map();
    for (const [i, item] of itens.entries()) {
      if (!mongoose.isValidObjectId(item?.produto))
        return res.status(400).json({ erro: `itens[${i}].produto: ID inválido` });
      if (!Number.isInteger(item.quantidade) || item.quantidade < 1)
        return res.status(400).json({ erro: `itens[${i}].quantidade deve ser um inteiro maior ou igual a 1` });
      const id = String(item.produto);
      quantidades.set(id, (quantidades.get(id) ?? 0) + item.quantidade);
    }

    // Busca os produtos no catálogo: o preço NUNCA vem do cliente
    const produtos = await Produto.find({ _id: { $in: [...quantidades.keys()] } });
    const porId = new Map(produtos.map((p) => [String(p._id), p]));
    const inexistentes = [...quantidades.keys()].filter((id) => !porId.has(id));
    if (inexistentes.length)
      return res.status(404).json({ erro: 'Produto(s) não encontrado(s)', ids: inexistentes });

    const itensVenda = [...quantidades].map(([id, quantidade]) => {
      const p = porId.get(id);
      return { produto: p._id, nomeProduto: p.nome, quantidade, precoUnitario: p.preco };
    });
    const total = arredondar(itensVenda.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0));

    const venda = await Venda.create({ cliente, data, itens: itensVenda, total });
    await venda.populate(POPULATE);
    res.status(201).json(venda);
  } catch (e) { erro(res, e); }
}

export async function listar(req, res) {
  try {
    const filtro = {};
    if (req.query.cliente) filtro['cliente.nome'] = new RegExp(String(req.query.cliente).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (req.query.de || req.query.ate) {
      filtro.data = {};
      if (req.query.de) filtro.data.$gte = new Date(req.query.de);
      if (req.query.ate) filtro.data.$lte = new Date(req.query.ate);
      if (Object.values(filtro.data).some((d) => isNaN(d)))
        return res.status(400).json({ erro: 'Datas inválidas em "de"/"ate" (use AAAA-MM-DD)' });
    }
    res.json(await Venda.find(filtro).sort({ data: -1 }).populate(POPULATE));
  } catch (e) { erro(res, e); }
}

export async function obter(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ erro: 'ID inválido' });
  try {
    const v = await Venda.findById(req.params.id).populate(POPULATE);
    return v ? res.json(v) : res.status(404).json({ erro: 'Venda não encontrada' });
  } catch (e) { erro(res, e); }
}
