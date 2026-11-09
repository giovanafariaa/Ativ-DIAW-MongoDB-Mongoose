import mongoose from 'mongoose';

// Item da venda (subdocumento incorporado). Referencia o produto por ObjectId
// e guarda o preço praticado no momento da venda (histórico de preços).
const itemVendaSchema = new mongoose.Schema({
  produto: { type: mongoose.Schema.Types.ObjectId, ref: 'Produto', required: true },
  nomeProduto: { type: String, required: true },          // snapshot do nome na data da venda
  quantidade: {
    type: Number, required: true, min: 1,
    validate: { validator: Number.isInteger, message: 'quantidade deve ser um número inteiro' }
  },
  precoUnitario: { type: Number, required: true, min: 0 }  // snapshot do preço na data da venda
}, { _id: false });

const vendaSchema = new mongoose.Schema({
  cliente: {
    nome: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true }
  },
  data: { type: Date, default: Date.now },
  itens: {
    type: [itemVendaSchema],
    validate: { validator: (v) => Array.isArray(v) && v.length > 0, message: 'A venda deve ter ao menos um item' }
  },
  total: { type: Number, required: true, min: 0 }
}, { timestamps: true });

vendaSchema.index({ data: -1 });
vendaSchema.index({ 'itens.produto': 1 });

export default mongoose.model('Venda', vendaSchema);
