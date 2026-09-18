-- Motuca Trainer [B42]: janela dentro do jogo. Abre com a tecla configurada (F7 por padrao).
-- Le o estado direto do personagem a cada frame; nao existe ponte, servidor nem arquivo.
require 'ISUI/ISCollapsableWindow'

MotucaTrainerUI = ISCollapsableWindow:derive('MotucaTrainerUI')

local PAD, ROW, GAP = 10, 22, 6
local VITALS, STATUS = 38, 22
local WIDTH, HEIGHT = 620, 540
-- ponytail: ISScrollingListBox percorre todos os itens por frame; 300 linhas bastam com a busca.
-- Subir o teto pede lista virtual (NIVirtualScrollView do NeatUI, ou pool proprio).
local CAP = 300

local QUICK = {
    { action = 'heal',      key = 'IGUI_Motuca_Heal' },
    { action = 'infection', key = 'IGUI_Motuca_Infection' },
    { action = 'needs',     key = 'IGUI_Motuca_Needs' },
    { action = 'rest',      key = 'IGUI_Motuca_Rest' },
}

local function newPanel(w, h)
    local p = ISPanel:new(0, 0, w, h)
    p:initialise()
    p:noBackground()
    return p
end

local function newLabel(parent, x, y, text)
    local l = ISLabel:new(x, y, ROW, text, 1, 1, 1, 0.75, UIFont.Small, true)
    l:initialise()
    parent:addChild(l)
    return l
end

local function newButton(parent, x, y, w, text, target, fn, payload)
    local b = ISButton:new(x, y, w, ROW, text, target, fn)
    b:initialise()
    b:instantiate()
    b.internal = payload
    b.borderColor = { r = 0.45, g = 0.45, b = 0.45, a = 1 }
    parent:addChild(b)
    return b
end

local function newEntry(parent, x, y, w, value)
    local e = ISTextEntryBox:new(tostring(value), x, y, w, ROW)
    e:initialise()
    e:instantiate()
    parent:addChild(e)
    return e
end

local function newList(parent, x, y, w, h)
    local l = ISScrollingListBox:new(x, y, w, h)
    l:initialise()
    l:instantiate()
    l.font = UIFont.Small
    l.fontHgt = getTextManager():getFontHeight(UIFont.Small)
    l.itemheight = l.fontHgt + 4
    l.itemPadY = 2
    l.drawBorder = true
    parent:addChild(l)
    return l
end

-- Busca por substring simples: Kahlua nao normaliza acento, entao "facao" nao acha "Facao".
local function matches(term, text)
    return term == '' or string.find(string.lower(text), term, 1, true) ~= nil
end

local function selected(list)
    local row = list.items[list.selected]
    return row and row.item or nil
end

local function numberOf(entry)
    return tonumber(entry:getText())
end

function MotucaTrainerUI:apply(what, command)
    local ok, err = MotucaCommands.run(command)
    self.status = ok and getText('IGUI_Motuca_Done', what) or err
    self.statusOk = ok
end

-- Aba Sobrevivente -----------------------------------------------------------

function MotucaTrainerUI:onQuick(button)
    self:apply(button.title, { action = button.internal })
end

function MotucaTrainerUI:onGodOn()
    self:apply(getText('IGUI_Motuca_God'), { action = 'god', enabled = true, seconds = numberOf(self.godSeconds) })
end

function MotucaTrainerUI:onGodOff()
    self:apply(getText('IGUI_Motuca_God'), { action = 'god', enabled = false, seconds = 1 })
end

function MotucaTrainerUI:onStatChange()
    local row = self.statBox:getOptionData(self.statBox.selected)
    if row then self.statValue:setText(tostring(row.default)) end
end

function MotucaTrainerUI:onStat()
    local row = self.statBox:getOptionData(self.statBox.selected)
    if not row then return end
    self:apply(getText('IGUI_Motuca_Stat_' .. row.key), { action = 'stat', stat = row.key, value = numberOf(self.statValue) })
end

function MotucaTrainerUI:survivorTab(w, h)
    local p = newPanel(w, h)
    local half = math.floor((w - PAD * 2 - GAP) / 2)
    for i, row in ipairs(QUICK) do
        local column = (i - 1) % 2
        local line = math.floor((i - 1) / 2)
        newButton(p, PAD + column * (half + GAP), PAD + line * (ROW + GAP), half, getText(row.key), self, self.onQuick, row.action)
    end

    local y = PAD + (ROW + GAP) * 2 + GAP
    newLabel(p, PAD, y, getText('IGUI_Motuca_God'))
    y = y + ROW
    newLabel(p, PAD, y, getText('IGUI_Motuca_Seconds'))
    self.godSeconds = newEntry(p, PAD + 90, y, 70, 60)
    newButton(p, PAD + 170, y, 100, getText('IGUI_Motuca_Enable'), self, self.onGodOn)
    newButton(p, PAD + 280, y, 100, getText('IGUI_Motuca_Disable'), self, self.onGodOff)

    y = y + ROW + GAP * 3
    newLabel(p, PAD, y, getText('IGUI_Motuca_Need'))
    y = y + ROW
    self.statBox = ISComboBox:new(PAD, y, 200, ROW, self, self.onStatChange)
    self.statBox:initialise()
    p:addChild(self.statBox)
    for _, row in ipairs(MotucaCommands.stats) do
        self.statBox:addOptionWithData(getText('IGUI_Motuca_Stat_' .. row.key) .. ' (' .. row.low .. '-' .. row.high .. ')', row)
    end
    self.statValue = newEntry(p, PAD + 210, y, 80, 0)
    newButton(p, PAD + 300, y, 100, getText('IGUI_Motuca_Apply'), self, self.onStat)
    return p
end

-- Aba Mochila ----------------------------------------------------------------

function MotucaTrainerUI:fillItems()
    local term = string.lower(self.itemSearch:getText() or '')
    local total = 0
    self.itemList:clear()
    for _, row in ipairs(MotucaCommands.items()) do
        if matches(term, row.name .. ' ' .. row.id) then
            total = total + 1
            if total <= CAP then self.itemList:addItem(row.name .. '   ' .. row.id, row) end
        end
    end
    self.itemInfo:setName(getText('IGUI_Motuca_Showing', tostring(math.min(total, CAP)), tostring(total)))
end

function MotucaTrainerUI:onAddItem()
    local row = selected(self.itemList)
    if not row then
        self.status = getText('IGUI_Motuca_SelectItem'); self.statusOk = false
        return
    end
    self:apply(row.name, { action = 'item', item = row.id, quantity = numberOf(self.itemQuantity) })
end

function MotucaTrainerUI:packTab(w, h)
    local p = newPanel(w, h)
    local bottom = ROW + GAP + PAD
    local y = PAD
    newLabel(p, PAD, y, getText('IGUI_Motuca_Search'))
    self.itemSearch = newEntry(p, PAD + 70, y, w - PAD * 2 - 260, '')
    self.itemSearch.target = self
    self.itemSearch.onTextChangeFunction = MotucaTrainerUI.fillItems
    self.itemInfo = newLabel(p, w - PAD - 180, y, '')

    y = y + ROW + GAP
    self.itemList = newList(p, PAD, y, w - PAD * 2, h - y - bottom)

    y = h - bottom + GAP
    newLabel(p, PAD, y, getText('IGUI_Motuca_Quantity'))
    self.itemQuantity = newEntry(p, PAD + 90, y, 60, 1)
    newButton(p, PAD + 160, y, 160, getText('IGUI_Motuca_AddItem'), self, self.onAddItem)
    return p
end

-- Aba Pericias ---------------------------------------------------------------

function MotucaTrainerUI:fillSkills()
    local rows = {}
    local perks = PerkFactory.PerkList
    for i = 0, perks:size() - 1 do
        local perk = perks:get(i)
        local id = tostring(perk:getType())
        local kind = Perks[id]
        if kind and kind ~= Perks.None and kind ~= Perks.MAX then
            rows[#rows + 1] = { id = id, name = tostring(perk:getName()) }
        end
    end
    table.sort(rows, function(a, b) return a.name < b.name end)
    self.skillList:clear()
    for _, row in ipairs(rows) do self.skillList:addItem(row.name, row) end
end

function MotucaTrainerUI:refreshSkills()
    local player = MotucaCommands.player()
    for _, entry in ipairs(self.skillList.items) do
        local level = player and player:getPerkLevel(Perks[entry.item.id])
        entry.text = entry.item.name .. '   ' .. (level or '-') .. ' / 10'
    end
end

function MotucaTrainerUI:onSkill(button)
    local row = selected(self.skillList)
    if not row then
        self.status = getText('IGUI_Motuca_SelectPerk'); self.statusOk = false
        return
    end
    self:apply(row.name, { action = 'skill', perk = row.id, mode = button.internal })
end

function MotucaTrainerUI:onAddXp()
    local row = selected(self.skillList)
    if not row then
        self.status = getText('IGUI_Motuca_SelectPerk'); self.statusOk = false
        return
    end
    self:apply(row.name, { action = 'xp', perk = row.id, amount = numberOf(self.xpAmount) })
end

function MotucaTrainerUI:skillsTab(w, h)
    local p = newPanel(w, h)
    local bottom = ROW * 2 + GAP * 2 + PAD
    self.skillList = newList(p, PAD, PAD, w - PAD * 2, h - PAD - bottom)

    local y = h - bottom + GAP
    newButton(p, PAD, y, 80, '+1', self, self.onSkill, 'plus')
    newButton(p, PAD + 90, y, 80, getText('IGUI_Motuca_Max'), self, self.onSkill, 'max')

    y = y + ROW + GAP
    newLabel(p, PAD, y, 'XP')
    self.xpAmount = newEntry(p, PAD + 40, y, 80, 100)
    newButton(p, PAD + 130, y, 160, getText('IGUI_Motuca_AddXp'), self, self.onAddXp)
    return p
end

-- Aba Personagem -------------------------------------------------------------

function MotucaTrainerUI:fillTraits()
    local term = string.lower(self.traitSearch:getText() or '')
    local _, labels = MotucaCommands.traits()
    local rows = {}
    for id, name in pairs(labels) do
        if matches(term, name .. ' ' .. id) then rows[#rows + 1] = { id = id, name = name } end
    end
    table.sort(rows, function(a, b) return a.name < b.name end)
    self.traitList:clear()
    for _, row in ipairs(rows) do self.traitList:addItem(row.name, row) end
end

function MotucaTrainerUI:refreshTraits()
    local player = MotucaCommands.player()
    local owned = {}
    if player then
        local known = player:getCharacterTraits():getKnownTraits()
        for i = 0, known:size() - 1 do owned[tostring(known:get(i):getName())] = true end
    end
    for _, entry in ipairs(self.traitList.items) do
        local mark = owned[entry.item.id] and getText('IGUI_Motuca_Owned') or ''
        entry.text = entry.item.name .. '   ' .. entry.item.id .. '   ' .. mark
    end
end

function MotucaTrainerUI:onTrait(button)
    local row = selected(self.traitList)
    if not row then
        self.status = getText('IGUI_Motuca_SelectTrait'); self.statusOk = false
        return
    end
    self:apply(row.name, { action = 'trait', trait = row.id, enabled = button.internal == true })
end

function MotucaTrainerUI:onHere()
    local player = MotucaCommands.player()
    if not player then return end
    self.tpx:setText(string.format('%.1f', player:getX()))
    self.tpy:setText(string.format('%.1f', player:getY()))
    self.tpz:setText(tostring(math.floor(player:getZ())))
end

function MotucaTrainerUI:onTeleport()
    self:apply(getText('IGUI_Motuca_Teleport'), {
        action = 'teleport',
        x = numberOf(self.tpx),
        y = numberOf(self.tpy),
        z = numberOf(self.tpz),
    })
end

function MotucaTrainerUI:characterTab(w, h)
    local p = newPanel(w, h)
    local bottom = ROW * 3 + GAP * 4 + PAD
    local y = PAD
    newLabel(p, PAD, y, getText('IGUI_Motuca_Search'))
    self.traitSearch = newEntry(p, PAD + 70, y, w - PAD * 2 - 70, '')
    self.traitSearch.target = self
    self.traitSearch.onTextChangeFunction = MotucaTrainerUI.fillTraits

    y = y + ROW + GAP
    self.traitList = newList(p, PAD, y, w - PAD * 2, h - y - bottom)

    y = h - bottom + GAP
    newButton(p, PAD, y, 160, getText('IGUI_Motuca_TraitAdd'), self, self.onTrait, true)
    newButton(p, PAD + 170, y, 160, getText('IGUI_Motuca_TraitRemove'), self, self.onTrait, false)

    y = y + ROW + GAP
    newLabel(p, PAD, y, getText('IGUI_Motuca_Teleport'))
    y = y + ROW + GAP
    for index, axis in ipairs({ 'x', 'y', 'z' }) do
        local left = PAD + (index - 1) * 105
        newLabel(p, left, y, string.upper(axis))
        self['tp' .. axis] = newEntry(p, left + 18, y, 80, 0)
    end
    newButton(p, PAD + 320, y, 120, getText('IGUI_Motuca_Here'), self, self.onHere)
    newButton(p, PAD + 450, y, 120, getText('IGUI_Motuca_Teleport'), self, self.onTeleport)
    return p
end

-- Janela ---------------------------------------------------------------------

function MotucaTrainerUI:createChildren()
    ISCollapsableWindow.createChildren(self)
    local top = self:titleBarHeight() + VITALS
    local w = self.width - PAD * 2
    local tabs = ISTabPanel:new(PAD, top, w, self.height - top - STATUS - PAD)
    tabs:initialise()
    self:addChild(tabs)
    self.tabs = tabs

    local h = tabs.height - tabs.tabHeight
    tabs:addView(getText('IGUI_Motuca_TabSurvivor'), self:survivorTab(w, h))
    tabs:addView(getText('IGUI_Motuca_TabPack'), self:packTab(w, h))
    tabs:addView(getText('IGUI_Motuca_TabSkills'), self:skillsTab(w, h))
    tabs:addView(getText('IGUI_Motuca_TabCharacter'), self:characterTab(w, h))

    self:onStatChange()
end

-- Catalogos dependem dos scripts do jogo: carrega na primeira abertura, nao no load do arquivo.
function MotucaTrainerUI:onOpen()
    if not self.filled then
        self:fillItems()
        self:fillSkills()
        self:fillTraits()
        self.filled = true
    end
end

function MotucaTrainerUI:prerender()
    ISCollapsableWindow.prerender(self)
    local y = self:titleBarHeight() + 3
    local player, unavailable = MotucaCommands.player()
    if player then
        local stats = player:getStats()
        local function percent(name) return math.floor(stats:get(CharacterStat[name]) * 100) end
        self:drawText(string.format('%s %d%%   %s %d%%   %s %d%%   %s %d%%',
            getText('IGUI_Motuca_Health'), math.floor(player:getBodyDamage():getOverallBodyHealth()),
            getText('IGUI_Motuca_Stat_hunger'), percent('HUNGER'),
            getText('IGUI_Motuca_Stat_thirst'), percent('THIRST'),
            getText('IGUI_Motuca_Stat_fatigue'), percent('FATIGUE')),
            PAD, y, 1, 1, 1, 0.9, UIFont.Small)
        self:drawText(string.format('%s %d / %d / %d   %s %s',
            getText('IGUI_Motuca_Coords'), math.floor(player:getX()), math.floor(player:getY()), math.floor(player:getZ()),
            getText('IGUI_Motuca_God'), player:isGodMod() and getText('IGUI_Motuca_On') or getText('IGUI_Motuca_Off')),
            PAD, y + 17, 0.8, 0.8, 0.8, 0.9, UIFont.Small)
    else
        self:drawText(unavailable, PAD, y, 1, 0.55, 0.35, 0.9, UIFont.Small)
    end

    local active = self.tabs and self.tabs:getActiveViewIndex()
    if active == 3 then self:refreshSkills() elseif active == 4 then self:refreshTraits() end

    if self.status then
        local r, g, b = 0.55, 0.9, 0.55
        if not self.statusOk then r, g, b = 1, 0.55, 0.35 end
        self:drawText(self.status, PAD, self.height - STATUS, r, g, b, 0.9, UIFont.Small)
    end
end

function MotucaTrainerUI:new(x, y, width, height)
    local o = ISCollapsableWindow.new(self, x, y, width, height)
    o:setTitle(getText('IGUI_Motuca_Title'))
    -- Sem redimensionar: os filhos usam posicao fixa, esticar a janela quebraria o layout.
    o:setResizable(false)
    o.status = nil
    o.statusOk = true
    return o
end

function MotucaTrainerUI.toggle()
    if not MotucaCommands.player() then return end
    local ui = MotucaTrainerUI.instance
    if not ui then
        ui = MotucaTrainerUI:new(math.floor((getCore():getScreenWidth() - WIDTH) / 2),
            math.floor((getCore():getScreenHeight() - HEIGHT) / 2), WIDTH, HEIGHT)
        ui:initialise()
        ui:addToUIManager()
        MotucaTrainerUI.instance = ui
        ui:onOpen()
        return
    end
    ui:setVisible(not ui:isVisible())
    if ui:isVisible() then
        ui:bringToTop()
        ui:onOpen()
    end
end

local function onKeyPressed(key)
    if getCore():isKey('Motuca Trainer', key) then MotucaTrainerUI.toggle() end
end

-- A janela guarda referencias do personagem anterior: descarta ao trocar de partida.
Events.OnGameStart.Add(function()
    if MotucaTrainerUI.instance then
        pcall(function() MotucaTrainerUI.instance:removeFromUIManager() end)
        MotucaTrainerUI.instance = nil
    end
end)

Events.OnKeyPressed.Add(onKeyPressed)

Events.OnGameBoot.Add(function()
    table.insert(keyBinding, { value = '[Motuca Trainer]' })
    table.insert(keyBinding, { value = 'Motuca Trainer', key = Keyboard.KEY_F7 })
end)
