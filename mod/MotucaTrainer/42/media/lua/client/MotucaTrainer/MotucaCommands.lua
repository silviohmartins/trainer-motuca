-- Motuca Trainer [B42]: mutacoes do jogo.
-- A UI nunca altera o personagem direto; passa sempre por MotucaCommands.run.
MotucaCommands = {}

-- Level 0: a mensagem chega na UI sem o prefixo "arquivo:linha".
local function fail(key) error(getText(key), 0) end

local function bounded(value, low, high, integer)
    if type(value) ~= 'number' or value ~= value or value < low or value > high or (integer and value ~= math.floor(value)) then
        fail('IGUI_Motuca_ErrRange')
    end
    return value
end

-- Um unico lugar define necessidade, stat do jogo e faixa valida; a UI le daqui.
MotucaCommands.stats = {
    { key = 'hunger',      stat = 'HUNGER',      low = 0,  high = 1,   default = 0  },
    { key = 'thirst',      stat = 'THIRST',      low = 0,  high = 1,   default = 0  },
    { key = 'fatigue',     stat = 'FATIGUE',     low = 0,  high = 1,   default = 0  },
    { key = 'pain',        stat = 'PAIN',        low = 0,  high = 100, default = 0  },
    { key = 'temperature', stat = 'TEMPERATURE', low = 30, high = 42,  default = 37 },
}
local byKey = {}
for _, row in ipairs(MotucaCommands.stats) do byKey[row.key] = row end

local function setStat(player, name, value) player:getStats():set(CharacterStat[name], value) end

local function clearInfection(player)
    local damage = player:getBodyDamage()
    local parts = damage:getBodyParts()
    for i = 0, parts:size() - 1 do
        parts:get(i):SetInfected(false)
        parts:get(i):SetFakeInfected(false)
    end
    damage:setInfected(false)
    damage:setIsFakeInfected(false)
    damage:setInfectionTime(-1)
    damage:setInfectionMortalityDuration(-1)
    setStat(player, 'ZOMBIE_INFECTION', 0)
    setStat(player, 'ZOMBIE_FEVER', 0)
end

-- Ids de traco vem das definicoes carregadas, nunca de lista fixa: mods trazem os seus.
local function traitKey(name) return (tostring(name):lower():gsub('_', '')) end
local traitKinds, traitLabels = nil, nil
function MotucaCommands.traits()
    if traitKinds then return traitKinds, traitLabels end
    traitKinds, traitLabels = {}, {}
    local definitions = CharacterTraitDefinition.getTraits()
    for i = 0, definitions:size() - 1 do
        local definition = definitions:get(i)
        local kind = definition:getType()
        if kind then
            local name = tostring(kind:getName())
            traitKinds[traitKey(name)] = kind
            traitLabels[name] = tostring(definition:getLabel())
        end
    end
    return traitKinds, traitLabels
end

local items = nil
function MotucaCommands.items()
    if items then return items end
    items = {}
    local all = getAllItems()
    for i = 0, all:size() - 1 do
        local item = all:get(i)
        if not item:getObsolete() and not item:isHidden() then
            items[#items + 1] = { id = item:getFullName(), name = item:getDisplayName(), module = item:getModuleName() }
        end
    end
    table.sort(items, function(a, b) return a.name < b.name end)
    return items
end

local function execute(player, command)
    local action = command.action
    if action == 'heal' then
        player:getBodyDamage():RestoreToFullHealth(); clearInfection(player); setStat(player, 'PAIN', 0)
    elseif action == 'infection' then clearInfection(player)
    elseif action == 'needs' then setStat(player, 'HUNGER', 0); setStat(player, 'THIRST', 0)
    elseif action == 'rest' then setStat(player, 'FATIGUE', 0); setStat(player, 'ENDURANCE', 1)
    elseif action == 'stat' then
        local row = byKey[command.stat]
        if not row then fail('IGUI_Motuca_ErrStat') end
        setStat(player, row.stat, bounded(command.value, row.low, row.high))
    elseif action == 'item' then
        -- FindItem e a validacao: o id vem do catalogo do jogo e nao cabe a este mod
        -- adivinhar o charset de um id de mod (492 dos 5108 itens de uma instalacao
        -- com mods trazem '-', e 4 itens do vanilla tambem).
        if type(command.item) ~= 'string' or #command.item > 200 then fail('IGUI_Motuca_ErrItemMissing') end
        local quantity = bounded(command.quantity, 1, 25, true)
        if not getScriptManager():FindItem(command.item) then fail('IGUI_Motuca_ErrItemMissing') end
        for _ = 1, quantity do
            if not player:getInventory():AddItem(command.item) then fail('IGUI_Motuca_ErrItemAdd') end
        end
    elseif action == 'skill' or action == 'xp' then
        local perk = type(command.perk) == 'string' and Perks[command.perk]
        if not perk or perk == Perks.None or perk == Perks.MAX then fail('IGUI_Motuca_ErrPerk') end
        if action == 'xp' then player:getXp():AddXP(perk, bounded(command.amount, 1, 10000, true))
        else
            if command.mode ~= 'plus' and command.mode ~= 'max' then fail('IGUI_Motuca_ErrMode') end
            local level = player:getPerkLevel(perk)
            local target = command.mode == 'max' and 10 or math.min(10, level + 1)
            for _ = level + 1, target do player:LevelPerk(perk) end
            player:getXp():setXPToLevel(perk, player:getPerkLevel(perk))
        end
    elseif action == 'trait' then
        local name = type(command.trait) == 'string' and command.trait
        -- Aceita o id exportado (NeedsMoreSleep) e a constante Lua (NEEDS_MORE_SLEEP).
        local kinds = MotucaCommands.traits()
        local trait = name and (kinds[traitKey(name)] or CharacterTrait[name])
        if not trait or type(command.enabled) ~= 'boolean' then fail('IGUI_Motuca_ErrTrait') end
        if player:hasTrait(trait) ~= command.enabled then
            if command.enabled then player:getCharacterTraits():add(trait) else player:getCharacterTraits():remove(trait) end
            player:modifyTraitXPBoost(trait, not command.enabled)
            if SyncXp then SyncXp(player) end -- Mesma ordem que a UI de debug do jogo usa.
        end
    elseif action == 'teleport' then
        local x = bounded(command.x, 0, 50000)
        local y = bounded(command.y, 0, 50000)
        local z = bounded(command.z, -32, 31, true)
        -- Restringe a quadrados carregados e pisaveis: coordenada solta deixa o personagem preso.
        local square = getCell():getGridSquare(x, y, z)
        if not square or not square:TreatAsSolidFloor() or not square:isFree(false) then fail('IGUI_Motuca_ErrTeleport') end
        if player:getVehicle() then fail('IGUI_Motuca_ErrVehicle') end
        player:teleportTo(x, y, z)
    elseif action == 'god' then
        if type(command.enabled) ~= 'boolean' then fail('IGUI_Motuca_ErrEnabled') end
        local seconds = bounded(command.seconds, 1, 600, true)
        local data = player:getModData()
        if command.enabled then
            if not data.MotucaGodUntil then data.MotucaGodBefore = player:isGodMod() end
            data.MotucaGodUntil = getTimestampMs() + seconds * 1000
            player:setGodMod(true)
        else
            player:setGodMod(false); data.MotucaGodUntil = nil; data.MotucaGodBefore = nil
        end
    else fail('IGUI_Motuca_ErrUnknown') end
end

-- Nunca em multiplayer, em servidor, nem com personagem morto.
function MotucaCommands.player()
    if isClient() or isServer() then return nil, getText('IGUI_Motuca_ErrSolo') end
    local player = getPlayer()
    if not player or player:isDead() then return nil, getText('IGUI_Motuca_ErrNoPlayer') end
    return player
end

-- Porta unica de entrada. Devolve ok, mensagem de erro.
function MotucaCommands.run(command)
    local player, unavailable = MotucaCommands.player()
    if not player then return false, unavailable end
    local ok, err = pcall(execute, player, command)
    return ok, not ok and tostring(err) or nil
end

local function restoreGod(player)
    local data = player:getModData()
    if data.MotucaGodUntil and getTimestampMs() >= data.MotucaGodUntil then
        player:setGodMod(data.MotucaGodBefore == true)
        data.MotucaGodUntil = nil; data.MotucaGodBefore = nil
    end
end

-- Continua contando com o jogo pausado, como o modo deus temporario promete.
Events.OnTickEvenPaused.Add(function()
    local player = getPlayer()
    if player then pcall(restoreGod, player) end
end)

-- Catalogos dependem dos scripts carregados: esquece na troca de partida.
Events.OnGameStart.Add(function() items = nil; traitKinds = nil; traitLabels = nil end)
