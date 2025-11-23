// buildDroplist.js
const fs = require("fs");
const path = require("path");

// --- Configurações de Caminho ---
const API_DIR = path.join(__dirname, "API");
const CITIES_DIR = path.join(API_DIR, "cities");
const ITEMS_FILE = path.join(API_DIR, "items.json");
const OUTPUT_FILE = path.join(__dirname, "droplist.json");

// --- Estruturas de Dados Finais ---
const finalDatabase = {
  maps: new Map(),
  monsters: new Map(),
  // Usaremos um Map para itens para facilitar o lookup durante o mapeamento reverso
  items: new Map(),
};

// --- Funções Auxiliares ---
function readJsonFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Erro ao ler/parsear ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Função principal para construir o arquivo droplist.json
 */
async function buildDroplist() {
  console.log("Iniciando construção do droplist.json (Mapeamento Reverso)...");

  // 1. Processar Arquivo de Itens (sem a chave 'drops')
  console.log(`Lendo itens de: ${ITEMS_FILE}`);
  const itemsData = readJsonFile(ITEMS_FILE);
  if (!itemsData || !Array.isArray(itemsData.items)) {
    console.error("Falha ao carregar ou formatar itens. Abortando.");
    return;
  }

  // Inicializa o Map de itens com um array de drops vazio em cada item
  itemsData.items.forEach((item) => {
    // Inicializa a propriedade 'drops' conforme esperado pela estrutura final
    item.drops = [];
    finalDatabase.items.set(item.id, item);
  });

  // 2. Processar Diretório de Cidades/Mapas e fazer o Mapeamento Reverso
  console.log(`\nLendo dados de cidades em: ${CITIES_DIR}`);
  try {
    const cityFiles = fs
      .readdirSync(CITIES_DIR)
      .filter((file) => file.endsWith(".json"));

    for (const file of cityFiles) {
      const filePath = path.join(CITIES_DIR, file);
      const cityData = readJsonFile(filePath);

      if (!cityData) continue;

      const mapKey = cityData.id;

      // 2.1. Adicionar Mapa
      finalDatabase.maps.set(mapKey, {
        name: cityData.name,
        imageUrl: cityData.imageUrl,
      });

      // 2.2. Adicionar Monstros e Inverter o Drop
      if (cityData.monsters) {
        for (const [monsterId, monsterData] of Object.entries(
          cityData.monsters
        )) {
          // a) Adiciona defaultMapId ao monstro (igual à correção anterior)
          const monsterDataWithDefaultMap = { ...monsterData };
          monsterDataWithDefaultMap.defaultMapId = mapKey;

          if (!finalDatabase.monsters.has(monsterId)) {
            finalDatabase.monsters.set(monsterId, monsterDataWithDefaultMap);
          }

          // b) Mapeamento Reverso: Iterar sobre os drops do monstro e anexar aos itens
          const itemDrops = monsterData.itemDrops || [];

          itemDrops.forEach((drop) => {
            const targetItem = finalDatabase.items.get(drop.itemId);

            if (targetItem) {
              // Cria o objeto DropSource (parcial) esperado na lista 'items'
              const newDropEntry = {
                monsterId: monsterId,
                mapId: mapKey, // O mapa de onde o monstro foi lido é o mapa padrão
                rate: drop.rate,
              };

              // Anexa o novo drop à lista do item
              targetItem.drops.push(newDropEntry);
            } else {
              console.warn(
                `  Item com ID "${drop.itemId}" (dropado por ${monsterId} em ${mapKey}) não encontrado na lista de itens base.`
              );
            }
          });
        }
      }
      console.log(` - Processado: ${cityData.name}`);
    }
  } catch (error) {
    console.error(`Falha ao ler o diretório de cidades:`, error.message);
    return;
  }

  // 3. Montar Objeto Final e Converter Mapas/Itens para Objetos/Arrays
  const outputData = {
    maps: Object.fromEntries(finalDatabase.maps),
    monsters: Object.fromEntries(finalDatabase.monsters),
    items: Array.from(finalDatabase.items.values()), // Converte o Map de volta para Array
  };

  // 4. Gravar o Arquivo Final
  try {
    const jsonString = JSON.stringify(outputData, null, 2);
    fs.writeFileSync(OUTPUT_FILE, jsonString, "utf8");
    console.log(
      `\n✅ Sucesso! Arquivo droplist.json gerado em: ${OUTPUT_FILE}`
    );
    console.log(`Mapas agregados: ${finalDatabase.maps.size}`);
    console.log(`Monstros agregados: ${finalDatabase.monsters.size}`);
    console.log(`Itens processados: ${finalDatabase.items.size}`);
  } catch (error) {
    console.error("Falha ao escrever droplist.json:", error.message);
  }
}

buildDroplist();
