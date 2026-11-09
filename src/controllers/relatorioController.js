import Venda from '../models/Venda.js';

const arredondar = (n) => Math.round(n * 100) / 100;

// GET /api/relatorios/vendas?limite=5&de=2025-01-01&ate=2025-12-31
// Consolidação em JavaScript, sempre com o precoUnitario gravado na venda.
export async function relatorioVendas(req, res) {
  try {
    const limite = Math.max(1, Number.parseInt(req.query.limite, 10) || 5);
    const filtro = {};
    if (req.query.de || req.query.ate) {
      filtro.data = {};
      if (req.query.de) filtro.data.$gte = new Date(req.query.de);
      if (req.query.ate) filtro.data.$lte = new Date(req.query.ate);
      if (Object.values(filtro.data).some((d) => isNaN(d)))
        return res.status(400).json({ erro: 'Datas inválidas em "de"/"ate" (use AAAA-MM-DD)' });
    }

    const vendas = await Venda.find(filtro).populate('itens.produto', 'nome categoria');

    let faturamentoTotal = 0;
    let unidadesVendidas = 0;
    const porProduto = new Map();

    for (const venda of vendas) {
      for (const item of venda.itens) {
        const subtotal = item.quantidade * item.precoUnitario; // preço histórico
        faturamentoTotal += subtotal;
        unidadesVendidas += item.quantidade;

        // item.produto é null se o produto foi excluído; usa o id/nome gravados na venda
        const id = String(item.produto?._id ?? item.produto);
        const acc = porProduto.get(id) ?? {
          produtoId: id,
          nome: item.produto?.nome ?? item.nomeProduto,
          categoria: item.produto?.categoria ?? null,
          quantidadeVendida: 0,
          faturamento: 0
        };
        acc.quantidadeVendida += item.quantidade;
        acc.faturamento += subtotal;
        porProduto.set(id, acc);
      }
    }

    const produtosMaisVendidos = [...porProduto.values()]
      .map((p) => ({ ...p, faturamento: arredondar(p.faturamento) }))
      .sort((a, b) => b.quantidadeVendida - a.quantidadeVendida || b.faturamento - a.faturamento)
      .slice(0, limite);

    res.json({
      totalVendas: vendas.length,
      faturamentoTotal: arredondar(faturamentoTotal),
      unidadesVendidas,
      ticketMedio: vendas.length ? arredondar(faturamentoTotal / vendas.length) : 0,
      produtosMaisVendidos
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro interno' });
  }
}
