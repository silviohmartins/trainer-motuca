export const skills = {
  Fitness:'Condicionamento', Strength:'Força', Sprinting:'Corrida', Lightfoot:'Passos leves', Nimble:'Agilidade', Sneak:'Furtividade',
  Axe:'Machado', Blunt:'Contundente longo', SmallBlunt:'Contundente curto', LongBlade:'Lâmina longa', SmallBlade:'Lâmina curta', Spear:'Lança', Maintenance:'Manutenção', Aiming:'Mira', Reloading:'Recarga',
  Woodwork:'Carpintaria', Cooking:'Culinária', Farming:'Agricultura', Doctor:'Primeiros socorros', Electricity:'Elétrica', MetalWelding:'Soldagem', Mechanics:'Mecânica', Tailoring:'Costura', Fishing:'Pesca', Trapping:'Armadilhas', PlantScavenging:'Coleta', Tracking:'Rastreamento', Blacksmith:'Ferraria', FlintKnapping:'Lascamento', Masonry:'Alvenaria', Pottery:'Cerâmica', Carving:'Escultura', Butchering:'Açougue', Glassmaking:'Vidraria'
};
export const items = ['Base.Axe','Base.HandAxe','Base.Shotgun','Base.ShotgunShells','Base.BaseballBat','Base.Crowbar','Base.Hammer','Base.Saw','Base.Screwdriver','Base.NailsBox','Base.Bandage','Base.Disinfectant','Base.Pills','Base.TinnedBeans','Base.WaterBottle','Base.Bag_BigHikingBag'];
export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
function fail(message) { throw new ApiError(400, message); }
function number(value, min, max, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(`Valor deve estar entre ${min} e ${max}${integer ? ' (inteiro)' : ''}.`);
  return value;
}
export function validate(action, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Objeto JSON obrigatório.');
  const out = { action };
  const allowed = [];
  const take = (key, value) => { allowed.push(key); out[key] = value; };
  switch (action) {
    case 'heal': case 'infection': case 'needs': case 'rest': break;
    case 'item':
      if (typeof input.item !== 'string' || !/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(input.item) || input.item.length > 100) fail('ID de item inválido. Exemplo: Base.Axe');
      take('item', input.item); take('quantity', number(input.quantity, 1, 25, true)); break;
    case 'stat': {
      const ranges = { hunger:[0,1], thirst:[0,1], fatigue:[0,1], pain:[0,100], temperature:[30,42] };
      if (!Object.hasOwn(ranges, input.stat)) fail('Necessidade inválida.');
      take('stat', input.stat); take('value', number(input.value, ...ranges[input.stat])); break;
    }
    case 'skill': case 'xp':
      if (!Object.hasOwn(skills, input.perk)) fail('Perícia inválida.');
      take('perk', input.perk);
      if (action === 'xp') take('amount', number(input.amount, 1, 10000, true));
      else { if (!['plus','max'].includes(input.mode)) fail('Modo inválido.'); take('mode', input.mode); }
      break;
    case 'trait':
      if (typeof input.trait !== 'string' || !/^[A-Z][A-Z0-9_]{1,63}$/.test(input.trait)) fail('Use a chave do traço, por exemplo BRAVE.');
      if (typeof input.enabled !== 'boolean') fail('enabled deve ser booleano.');
      take('trait', input.trait); take('enabled', input.enabled); break;
    case 'god':
      if (typeof input.enabled !== 'boolean') fail('enabled deve ser booleano.');
      take('enabled', input.enabled); take('seconds', number(input.seconds, 1, 600, true)); break;
    case 'teleport': take('x', number(input.x, 0, 50000)); take('y', number(input.y, 0, 50000)); take('z', number(input.z, -32, 31, true)); break;
    default: fail('Comando desconhecido.');
  }
  if (Object.keys(input).some(key => !allowed.includes(key))) fail('Campo desconhecido.');
  return out;
}
