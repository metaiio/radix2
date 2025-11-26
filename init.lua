local stuckDetection = {
    lastPos = {x = 0, y = 0, z = 0},
    lastMoveTime = os.clock() * 1000,
    stuckCount = 0,
    maxStuckAttempts = 3,
    stuckTimeThreshold = 5000,
    movementThreshold = 3
}

function stuckDetection.reset()
end

function stuckDetection.checkIfStuck()
end

function stuckDetection.performUnstuck()
end

local mq = require 'mq'
require 'ImGui'
local recipes = require 'recipes'

local meta = {version='0.2',name='radix'}

local openGUI, shouldDrawGUI = true, true

local ingredientsArray = {}
local invSlotContainers = {['Fletching Kit'] = true, ['Feir`Dal Fletching Kit'] = true, ['Jeweler\'s Kit'] = true, ['Mixing Bowl'] = true, ['Essence Fusion Chamber'] = true, ['Medicine Bag'] = true}

local ingredientFilter = ''
local filteredIngredients = {}
local useIngredientFilter = false
local function filterIngredients()
    filteredIngredients = {}
    for _,ingredient in pairs(ingredientsArray) do
        if ingredient.Name:lower():find(ingredientFilter:lower()) then
            table.insert(filteredIngredients, ingredient)
        end
    end
end


local ColumnID_Name = 1
local ColumnID_Location = 2
local ColumnID_SourceType = 3
local ColumnID_Zone = 4
local current_sort_specs = nil
local function CompareWithSortSpecs(a, b)
    for n = 1, current_sort_specs.SpecsCount, 1 do
        local sort_spec = current_sort_specs:Specs(n)
        local delta = 0

        local sortA = a.Name
        local sortB = b.Name
        if sort_spec.ColumnUserID == ColumnID_Name then
            sortA = a.Name
            sortB = b.Name
        elseif sort_spec.ColumnUserID == ColumnID_Location then
            sortA = a.Location
            sortB = b.Location
        elseif sort_spec.ColumnUserID == ColumnID_SourceType then
            sortA = a.SourceType
            sortB = b.SourceType
        elseif sort_spec.ColumnUserID == ColumnID_Zone then
            sortA = (a.Zone and a.Zone) or (a.SourceType ~= 'Vendor' and a.Location) or 'Temple of Marr'
            sortB = (b.Zone and b.Zone) or (b.SourceType ~= 'Vendor' and b.Location) or 'Temple of Marr'
        end
        if sortA < sortB then
            delta = -1
        elseif sortB < sortA then
            delta = 1
        else
            delta = 0
        end

        if delta ~= 0 then
            if sort_spec.SortDirection == ImGuiSortDirection.Ascending then
                return delta < 0
            end
            return delta > 0
        end
    end

    return a.Name < b.Name
end

local selectedTradeskill = nil
local selectedRecipe = nil
local maxPossibleCombines = nil
local buying = {
    Recipe = '',
    Qty = 1000,
    Status = false
}
local requesting = {
    Status = false
}
local crafting = {
    Status = false,
    StopAtTrivial = true,
    AutoSell = false,
    NumMade = 0,
    SuccessMessage = nil,
    FailedMessage = nil,
}
local selling = {
    Status = false
}
local craftQueue = {}  -- For Craft All functionality
local function RecipeTreeNode(recipe, tradeskill, tradeskillName, idx)
    if recipe.Trivial >= tradeskill + 50 then
        ImGui.PushStyleColor(ImGuiCol.Text, 1,0,0,1)
    elseif recipe.Trivial >= tradeskill + 10 then
        ImGui.PushStyleColor(ImGuiCol.Text, 1,1,0,1)
    elseif recipe.Trivial <= tradeskill then
        ImGui.PushStyleColor(ImGuiCol.Text, 0,1,0,1)
    else
        ImGui.PushStyleColor(ImGuiCol.Text, 1,1,1,1)
    end
    
    local displayName = recipe.Recipe
    if recipe.Tradeskill and recipe.Tradeskill ~= tradeskillName then
        displayName = string.format('%s [%s]', recipe.Recipe, recipe.Tradeskill:upper())
    end
    
    local expanded = ImGui.TreeNode(('%s (Trivial: %s) (Qty: %s)###%s%s'):format(displayName, recipe.Trivial, mq.TLO.FindItemCount('='..recipe.Recipe)(), recipe.Recipe, idx))
    ImGui.PopStyleColor()
    ImGui.SameLine()
    if ImGui.SmallButton('Select##'..recipe.Recipe..idx) then
        selectedRecipe = recipe
        crafting.FailedMessage = nil
        crafting.SuccessMessage = nil
    end
    if expanded then
        ImGui.Indent(15)
        for i,material in ipairs(recipe.Materials) do
            if recipes.Subcombines[material] then
                RecipeTreeNode(recipes.Subcombines[material], tradeskill, tradeskillName, idx+i)
            else
                local matInfo = recipes.Materials[material]
                local locationText = ''
                if matInfo then
                    locationText = ' - ' .. matInfo.Location
                    if matInfo.Zone and matInfo.Zone ~= mq.TLO.Zone.ShortName() then
                        locationText = locationText .. ' [' .. matInfo.Zone .. ']'
                    end
                end
                ImGui.Text('%s%s', material, locationText)
                ImGui.SameLine()
                ImGui.TextColored(1,1,0,1,'(Qty: %s)', mq.TLO.FindItemCount('='..material)())
            end
        end
        ImGui.Unindent(15)
        ImGui.TreePop()
    end
end

local function drawSelectedRecipeBar(tradeskill)
    if selectedRecipe then
        ImGui.Text('Selected Recipe: ')
        ImGui.SameLine()
        ImGui.TextColored(1,1,0,1,'%s', selectedRecipe.Recipe)
        
        if selectedRecipe.Tradeskill and selectedRecipe.Tradeskill ~= tradeskill then
            ImGui.SameLine()
            ImGui.TextColored(1,0.5,0,1,'⚠️ This is a %s recipe!', selectedRecipe.Tradeskill:upper())
        end
        
        if not buying.Status and not requesting.Status and not crafting.Status and not selling.Status then
            if ImGui.Button('Craft') then
                crafting.Status = true
                crafting.OutOfMats = false
                selectedTradeskill = selectedRecipe.Tradeskill or tradeskill
            end
            ImGui.SameLine()
            if ImGui.Button('Craft All') then
                crafting.Status = true
                crafting.OutOfMats = false
                selectedTradeskill = selectedRecipe.Tradeskill or tradeskill
                buying.Qty = -1
            end
            ImGui.SameLine()
            if ImGui.Button('Buy Mats') then
                buying.Status = true
            end
            ImGui.SameLine()
            if ImGui.Button('Request Mats') then
                requesting.Status = true
            end
            ImGui.SameLine()
            ImGui.PushItemWidth(150)
            buying.Qty = ImGui.InputInt('Qty', buying.Qty, 1, 10)
            if buying.Qty < 1 and buying.Qty ~= -1 then buying.Qty = 1 end  -- Allow -1 for Craft All mode
            if maxPossibleCombines and buying.Qty > maxPossibleCombines then 
                buying.Qty = maxPossibleCombines 
            end
            ImGui.PopItemWidth()
            ImGui.SameLine()
            if maxPossibleCombines then
                ImGui.Text('(Max: %d)', maxPossibleCombines)
            else
                ImGui.Text('(Max: calculating...)')
            end
            ImGui.SameLine()
            crafting.Destroy = ImGui.Checkbox('Destroy', crafting.Destroy)
            ImGui.SameLine()
            crafting.StopAtTrivial = ImGui.Checkbox('Stop At Trivial', crafting.StopAtTrivial)
            ImGui.SameLine()
            crafting.AutoSell = ImGui.Checkbox('Auto-Sell When Full', crafting.AutoSell)
            ImGui.SameLine()
            if ImGui.Button('Sell') then
                selling.Status = true
            end
            ImGui.Text('Free Inventory: %s', mq.TLO.Me.FreeInventory())
            if crafting.FailedMessage then
                ImGui.TextColored(1, 0, 0, 1, '%s', crafting.FailedMessage)
            elseif crafting.SuccessMessage then
                ImGui.TextColored(0, 1, 0, 1, '%s', crafting.SuccessMessage)
            end
        else
            ImGui.Text('Free Inventory: %s', mq.TLO.Me.FreeInventory())
            ImGui.PushStyleColor(ImGuiCol.Text, 1,0,0,1)
            if ImGui.Button('Cancel') then
                crafting.Status, selling.Status, buying.Status = false, false, false
            end
            ImGui.PopStyleColor()
            ImGui.SameLine()
            if crafting.Status then
                ImGui.TextColored(0,1,0,1,'Crafting "%s" in progress... (%s/%s)', selectedRecipe.Recipe, crafting.NumMade, buying.Qty)
            elseif selling.Status then
                ImGui.TextColored(0,1,0,1,'Selling "%s"', selectedRecipe.Recipe)
            else
                ImGui.TextColored(0,1,0,1,'Gathering Materials for "%s"...', selectedRecipe.Recipe)
            end
        end
    end
end

local function pushStyle()
    local t = {
        windowbg = ImVec4(.1, .1, .1, .9),
        bg = ImVec4(0, 0, 0, 1),
        hovered = ImVec4(.4, .4, .4, 1),
        active = ImVec4(.3, .3, .3, 1),
        button = ImVec4(.3, .3, .3, 1),
        text = ImVec4(1, 1, 1, 1),
    }
    ImGui.PushStyleColor(ImGuiCol.WindowBg, t.windowbg)
    ImGui.PushStyleColor(ImGuiCol.TitleBg, t.bg)
    ImGui.PushStyleColor(ImGuiCol.TitleBgActive, t.active)
    ImGui.PushStyleColor(ImGuiCol.FrameBg, t.bg)
    ImGui.PushStyleColor(ImGuiCol.FrameBgHovered, t.hovered)
    ImGui.PushStyleColor(ImGuiCol.FrameBgActive, t.active)
    ImGui.PushStyleColor(ImGuiCol.Button, t.button)
    ImGui.PushStyleColor(ImGuiCol.ButtonHovered, t.hovered)
    ImGui.PushStyleColor(ImGuiCol.ButtonActive, t.active)
    ImGui.PushStyleColor(ImGuiCol.PopupBg, t.bg)
    ImGui.PushStyleColor(ImGuiCol.Tab, 0, 0, 0, 0)
    ImGui.PushStyleColor(ImGuiCol.TabActive, t.active)
    ImGui.PushStyleColor(ImGuiCol.TabHovered, t.hovered)
    ImGui.PushStyleColor(ImGuiCol.TabUnfocused, t.bg)
    ImGui.PushStyleColor(ImGuiCol.TabUnfocusedActive, t.hovered)
    ImGui.PushStyleColor(ImGuiCol.TextDisabled, t.text)
    ImGui.PushStyleColor(ImGuiCol.CheckMark, t.text)
    ImGui.PushStyleColor(ImGuiCol.Separator, t.hovered)

    ImGui.PushStyleVar(ImGuiStyleVar.WindowRounding, 10)
end

local function popStyles()
    ImGui.PopStyleColor(18)
    ImGui.PopStyleVar(1)
end

local tradeskills = {'Baking','Blacksmithing','Brewing','Fletching','Jewelry Making','Pottery','Tailoring','Alchemy'}
local function radixGUI()
    ImGui.SetNextWindowSize(ImVec2(800,500), ImGuiCond.FirstUseEver)
    pushStyle()
    openGUI, shouldDrawGUI = ImGui.Begin('Radix ('.. meta.version ..')###radixgui', openGUI, ImGuiWindowFlags.HorizontalScrollbar)
    if shouldDrawGUI then
        if ImGui.BeginTabBar('##TradeskillTabs') then
            for _,tradeskill in ipairs(tradeskills) do
                if tradeskill ~= 'Alchemy' or mq.TLO.Me.Class.ShortName() == 'SHM' then
                    local currentSkill = (tradeskill == 'Radix' and 300) or mq.TLO.Me.Skill(tradeskill)() or 0
                    ImGui.PushStyleColor(ImGuiCol.Text, currentSkill == 300 and 0 or 1, currentSkill == 300 and 1 or 0, 0, 1)
                    local label
                    if tradeskill == 'Radix' then
                        label = 'Radix'
                    elseif currentSkill == 300 then
                        label = tradeskill .. '##' .. tradeskill
                    else
                        label = ('%s (%s/300)###%s'):format(tradeskill, currentSkill, tradeskill)
                    end
                    local beginTab = ImGui.BeginTabItem(label)
                    ImGui.PopStyleColor()
                    if beginTab then
                        drawSelectedRecipeBar(tradeskill)
                        ImGui.Separator()
                        for _,recipe in ipairs(recipes[tradeskill]) do
                            RecipeTreeNode(recipe, currentSkill, tradeskill, 0)
                        end
                        ImGui.EndTabItem()
                    end
                end
            end
            if ImGui.BeginTabItem('Radix') then
                drawSelectedRecipeBar('Blacksmithing')
                ImGui.Separator()
                for _,recipe in ipairs(recipes.Radix) do
                    RecipeTreeNode(recipe, 300, 'Radix', 0)
                end
                ImGui.EndTabItem()
            end
            if ImGui.BeginTabItem('Materials') then
                ImGui.PushItemWidth(300)
                local tmpIngredientFilter = ImGui.InputTextWithHint('##materialfilter', 'Search...', ingredientFilter)
                ImGui.PopItemWidth()
                if tmpIngredientFilter ~= ingredientFilter then
                    ingredientFilter = tmpIngredientFilter
                    filterIngredients()
                end
                if ingredientFilter ~= '' then useIngredientFilter = true else useIngredientFilter = false end
                local tmpIngredients = ingredientsArray
                if useIngredientFilter then tmpIngredients = filteredIngredients end

                if ImGui.BeginTable('Materials', 5, bit32.bor(ImGuiTableFlags.BordersInner, ImGuiTableFlags.RowBg, ImGuiTableFlags.Reorderable, ImGuiTableFlags.NoSavedSettings, ImGuiTableFlags.ScrollX, ImGuiTableFlags.ScrollY, ImGuiTableFlags.Sortable)) then
                    ImGui.TableSetupScrollFreeze(0, 1)
                    ImGui.TableSetupColumn('Material', bit32.bor(ImGuiTableColumnFlags.DefaultSort, ImGuiTableColumnFlags.WidthFixed), -1.0, ColumnID_Name)
                    ImGui.TableSetupColumn('Location', bit32.bor(ImGuiTableColumnFlags.WidthFixed), -1.0, ColumnID_Location)
                    ImGui.TableSetupColumn('Source', bit32.bor(ImGuiTableColumnFlags.WidthFixed), -1.0, ColumnID_SourceType)
                    ImGui.TableSetupColumn('Zone', bit32.bor(ImGuiTableColumnFlags.WidthFixed), -1.0, ColumnID_Zone)
                    ImGui.TableSetupColumn('Count', bit32.bor(ImGuiTableColumnFlags.NoSort, ImGuiTableColumnFlags.WidthFixed), -1.0, 0)
                    ImGui.TableHeadersRow()

                    local sort_specs = ImGui.TableGetSortSpecs()
                    if sort_specs then
                        if sort_specs.SpecsDirty then
                            current_sort_specs = sort_specs
                            table.sort(tmpIngredients, CompareWithSortSpecs)
                            current_sort_specs = nil
                            sort_specs.SpecsDirty = false
                        end
                    end

                    for _,ingredient in ipairs(tmpIngredients) do
                        ImGui.TableNextRow()
                        ImGui.TableNextColumn()
                        ImGui.Text(ingredient.Name)
                        ImGui.TableNextColumn()
                        ImGui.Text(ingredient.Location)
                        ImGui.TableNextColumn()
                        ImGui.Text(ingredient.SourceType)
                        ImGui.TableNextColumn()
                        ImGui.Text('%s', (ingredient.Zone and ingredient.Zone) or (ingredient.SourceType ~= 'Vendor' and ingredient.Location) or 'Temple of Marr')
                        ImGui.TableNextColumn()
                        ImGui.Text('%s', mq.TLO.FindItemCount('='..ingredient.Name)())
                    end
                    ImGui.EndTable()
                end
                ImGui.EndTabItem()
            end
            ImGui.EndTabBar()
        end
    end
    ImGui.End()
    popStyles()
    if not openGUI then
        mq.exit()
    end
end

local function goToVendor()
    if not mq.TLO.Target() then
        return false
    end
    local vendorName = mq.TLO.Target.CleanName()

    if mq.TLO.Target.Distance() > 15 then
        mq.cmdf('/nav spawn %s', vendorName)
        mq.delay(50)
        mq.delay(60000, function() return not mq.TLO.Navigation.Active() end)
    end
    return true
end

local function openVendor()
    mq.cmd('/nomodkey /click right target')
    mq.delay(1000, function() return mq.TLO.Window('MerchantWnd').Open() end)
    if not mq.TLO.Window('MerchantWnd').Open() then return false end
    mq.delay(5000, function() return mq.TLO.Merchant.ItemsReceived() end)
    return mq.TLO.Merchant.ItemsReceived()
end

local itemNoValue = nil
local function eventNovalue(line, item)
    itemNoValue = item
end
mq.event("Novalue", "#*#give you absolutely nothing for the #1#.#*#", eventNovalue)

local NEVER_SELL = {['Diamond Coin']=true, ['Celestial Crest']=true, ['Gold Coin']=true, ['Taelosian Symbols']=true, ['Planar Symbols']=true}
local function sellToVendor(itemToSell, bag, slot)
    if NEVER_SELL[itemToSell] then return end
    if mq.TLO.Window('MerchantWnd').Open() then
        if slot == nil or slot == -1 then
            mq.cmdf('/nomodkey /itemnotify %s leftmouseup', bag)
        else
            mq.cmdf('/nomodkey /itemnotify in pack%s %s leftmouseup', bag, slot)
        end
        mq.delay(1000, function() return mq.TLO.Window('MerchantWnd/MW_SelectedItemLabel').Text() == itemToSell() end)
        mq.cmd('/nomodkey /shiftkey /notify merchantwnd MW_Sell_Button leftmouseup')
        mq.doevents('eventNovalue')
        if itemNoValue == itemToSell then
            itemNoValue = nil
        end
        mq.delay(1000, function() return mq.TLO.Window("MerchantWnd/MW_Sell_Button")() ~= "TRUE" end)
    end
end

local function RestockItems(BuyItems, isTool)
    local rowNum = 0
    for itemName, qty in pairs(BuyItems) do
        rowNum = mq.TLO.Window("MerchantWnd/MW_ItemList").List('='..itemName,2)() or 0
        mq.delay(20)
        local haveCount = mq.TLO.FindItemCount('='..itemName)()
        if isTool and haveCount >= 1 then return end
        
        -- Keep buying until we have enough (handles vendor purchase limits)
        local purchaseAttempts = 0
        local maxAttempts = 100  -- Safety limit to prevent infinite loops
        
        while haveCount < qty and rowNum ~= 0 and purchaseAttempts < maxAttempts do
            local tmpQty = qty - haveCount
            purchaseAttempts = purchaseAttempts + 1
            
            mq.TLO.Window("MerchantWnd/MW_ItemList").Select(rowNum)()
            mq.delay(1000, function() return mq.TLO.Window('MerchantWnd/MW_SelectedItemLabel').Text() == itemName end)
            mq.TLO.Window("MerchantWnd/MW_Buy_Button").LeftMouseUp()
            mq.delay(500, function () return mq.TLO.Window("QuantityWnd").Open() end)
            if mq.TLO.Window("QuantityWnd").Open() then
                mq.TLO.Window("QuantityWnd/QTYW_SliderInput").SetText(tostring(tmpQty))()
                mq.delay(100, function () return mq.TLO.Window("QuantityWnd/QTYW_SliderInput").Text() == tostring(tmpQty) end)
                mq.TLO.Window("QuantityWnd/QTYW_Accept_Button").LeftMouseUp()
                mq.delay(100)
            end
            
            -- Wait for purchase to complete and check if count increased
            local prevCount = haveCount
            mq.delay(1000, function () return mq.TLO.FindItemCount('='..itemName)() > prevCount end)
            haveCount = mq.TLO.FindItemCount('='..itemName)()
            
            -- Safety check: if count didn't increase, vendor may be out of stock
            if haveCount == prevCount then
                printf('WARNING: Failed to purchase %s after %d attempts - vendor may be out of stock or purchase limit reached', itemName, purchaseAttempts)
                break
            end
            
            -- Log progress for items requiring multiple purchases
            if haveCount < qty then
                printf('  Purchased batch of %s, now have %d/%d (buying more...)', itemName, haveCount, qty)
            end
        end
        
        -- Final count check
        if haveCount >= qty then
            printf('  Successfully purchased %s: %d total', itemName, haveCount)
        end
    end
end

local function waitForCursor(time)
    mq.delay(time or 1000, function() return mq.TLO.Cursor() end)
end

local function waitForEmptyCursor(time)
    mq.delay(time or 1000, function() return not mq.TLO.Cursor() end)
end

local function clearCursor(num)
    local upper = num or 5
    local attempts = 0
    
    while mq.TLO.Cursor() and attempts < upper do
        attempts = attempts + 1
        local itemOnCursor = mq.TLO.Cursor.Name()
        
        mq.cmd('/autoinv')
        waitForEmptyCursor(2000)  -- Wait up to 2 seconds for autoinv
        
        if mq.TLO.Cursor() then
            -- Still on cursor after wait - try again unless we've exhausted attempts
            if attempts >= upper then
                printf('WARNING: Cannot /autoinv "%s" after %d attempts - inventory may be full!', itemOnCursor, attempts)
                return false
            end
            -- Otherwise loop will retry
        end
    end
    
    return true
end

-- More thorough cursor clearing for after combines - handles tools and salvaged items
local function clearCursorAfterCombine(recipeName)
    local itemsCleared = 0
    local maxItems = 10  -- Safety limit - most we'd expect is crafted item + tool + maybe salvage
    local maxWaitTime = 5000  -- 5 seconds max to wait for items to appear
    local waitInterval = 250  -- Check every 250ms
    local totalWaited = 0
    
    -- First, wait a moment for items to start appearing on cursor
    mq.delay(500)
    
    -- Keep clearing until cursor stays empty for a bit
    local emptyChecks = 0
    local requiredEmptyChecks = 3  -- Cursor must be empty for 3 consecutive checks
    
    while emptyChecks < requiredEmptyChecks and totalWaited < maxWaitTime do
        if mq.TLO.Cursor() then
            emptyChecks = 0  -- Reset empty counter
            local itemOnCursor = mq.TLO.Cursor.Name()
            local stackCount = mq.TLO.Cursor.Stack() or 1
            
            printf('  [Cursor] Found: %s (x%d) - moving to inventory', itemOnCursor, stackCount)
            
            mq.cmd('/autoinv')
            mq.delay(500)  -- Wait for autoinv to process
            
            -- If still on cursor, try again with longer delay
            if mq.TLO.Cursor() then
                mq.delay(500)
                mq.cmd('/autoinv')
                mq.delay(500)
            end
            
            -- Count it if it cleared
            if not mq.TLO.Cursor() or mq.TLO.Cursor.Name() ~= itemOnCursor then
                itemsCleared = itemsCleared + 1
            end
            
            if itemsCleared >= maxItems then
                printf('  [Cursor] WARNING: Cleared %d items - stopping to prevent infinite loop', itemsCleared)
                break
            end
        else
            -- Cursor is empty - increment check counter
            emptyChecks = emptyChecks + 1
            mq.delay(waitInterval)
            totalWaited = totalWaited + waitInterval
        end
    end
    
    -- Final verification
    if mq.TLO.Cursor() then
        local stuckItem = mq.TLO.Cursor.Name()
        printf('  [Cursor] WARNING: Item still on cursor after clearing: %s', stuckItem)
        printf('  [Cursor] Attempting forced clear...')
        
        for i = 1, 5 do
            mq.cmd('/autoinv')
            mq.delay(1000)
            if not mq.TLO.Cursor() then
                printf('  [Cursor] Forced clear successful on attempt %d', i)
                itemsCleared = itemsCleared + 1
                break
            end
        end
        
        if mq.TLO.Cursor() then
            printf('  [Cursor] ERROR: Could not clear cursor - inventory may be full!')
            return false, itemsCleared
        end
    end
    
    if itemsCleared > 0 then
        printf('  [Cursor] Cleared %d item(s) from cursor', itemsCleared)
    end
    
    return true, itemsCleared
end

-- Verify cursor is empty before placing materials - prevents placing on top of stuck items
local function ensureCursorEmpty()
    if not mq.TLO.Cursor() then
        return true
    end
    
    printf('  [Cursor] WARNING: Cursor not empty before material placement!')
    printf('  [Cursor] Item on cursor: %s', mq.TLO.Cursor.Name())
    
    -- Try to clear it
    local success = clearCursor(5)
    
    if not success then
        printf('  [Cursor] ERROR: Could not clear cursor before placing materials!')
        return false
    end
    
    printf('  [Cursor] Cursor cleared successfully')
    return true
end

local function reopenContainerWithRetry(containerName, pack)
    local maxAttempts = 5
    local attempt = 0
    
    printf('  [DEBUG] reopenContainerWithRetry called with: containerName="%s", pack="%s"', containerName, pack or 'nil')
    
    while attempt < maxAttempts do
        attempt = attempt + 1
        
        if attempt == 1 then
            printf('  Reopening %s...', containerName)
        else
            printf('  Retry attempt %d/%d to reopen %s...', attempt, maxAttempts, containerName)
        end
        
        -- Try to open the container
        if pack == 'Enviro' then
            -- For crafting stations
            printf('  [DEBUG] Opening crafting station')
            mq.cmdf('/mqt %s', containerName)
            mq.delay(1000)
            if mq.TLO.Target.Distance() > 15 then
                mq.cmdf('/nav spawn %s', containerName)
                mq.delay(60000, function() return not mq.TLO.Navigation.Active() end)
            end
            mq.cmd('/click left target')
            mq.delay(2500, function() return mq.TLO.Window('TradeskillWnd').Open() end)
        else
            -- For inventory containers - use the pack slot notation that was passed in
            printf('  [DEBUG] Opening inventory container using pack slot: %s', pack)
            
            -- Close inventory bags if open (they might interfere)
            if mq.TLO.Window('InventoryWindow').Open() then
                printf('  [DEBUG] Closing inventory windows first')
                mq.cmd('/keypress CLOSE_INV_BAGS')
                mq.delay(500)
            end
            
            mq.cmdf('/itemnotify "%s" rightmouseup', pack)
            mq.delay(2500, function() return mq.TLO.Window('TradeskillWnd').Open() end)
        end
        
        -- Check if it worked
        local windowOpen = mq.TLO.Window('TradeskillWnd').Open()
        printf('  [DEBUG] After open attempt: TradeskillWnd.Open() = %s', tostring(windowOpen))
        
        if windowOpen then
            printf('  Container opened successfully%s', attempt > 1 and (' after ' .. attempt .. ' attempts') or '')
            return true
        end
        
        -- If not opened and we have more attempts, wait before retry
        if attempt < maxAttempts then
            printf('  Container did not open, waiting 2 seconds before retry...')
            mq.delay(2000)
        end
    end
    
    -- All attempts failed
    printf('  ERROR: Failed to reopen container after %d attempts', maxAttempts)
    return false
end

local function autoSellCraftedItems()
    if not selectedRecipe then return false end
    
    printf('========================================')
    printf('AUTO-SELL TRIGGERED')
    printf('========================================')
    printf('Inventory full! Auto-selling crafted items: %s', selectedRecipe.Recipe)
    
    local wasOpen = mq.TLO.Window('TradeskillWnd').Open()
    
    if wasOpen then
        printf('Step 1: Closing tradeskill window...')
        mq.TLO.Window('TradeskillWnd').DoClose()
        mq.delay(500)
    end
    
    if mq.TLO.Cursor() then
        local cursorItem = mq.TLO.Cursor.Name()
        printf('WARNING: Cursor has "%s" at start of auto-sell', cursorItem)
        local cleared = clearCursor(3)
        if not cleared then
            printf('ERROR: Could not clear cursor at start - aborting auto-sell')
            crafting.FailedMessage = 'Cursor stuck - auto-sell aborted'
            return false
        end
    end
    
    printf('Step 2: Finding nearest merchant...')
    
    mq.cmd('/mqt merchant')
    mq.delay(2000)
    
    local attempts = 0
    while not mq.TLO.Target() and attempts < 3 do
        attempts = attempts + 1
        printf('  Attempt %d: No target found, trying again...', attempts)
        mq.cmd('/mqt merchant')
        mq.delay(2000)
    end
    
    if not mq.TLO.Target() then
        printf('  ERROR: Could not find any merchant to target!')
        printf('  Make sure you are in a zone with merchants nearby')
        crafting.FailedMessage = 'No merchant found!'
        return false
    end
    
    local merchantName = mq.TLO.Target.CleanName()
    printf('  Merchant targeted: %s', merchantName)
    
    if not goToVendor() then 
        printf('  ERROR: Failed to reach merchant: %s', merchantName)
        crafting.FailedMessage = 'Could not reach merchant'
        return false 
    end
    
    printf('Step 3: Opening merchant window...')
    if not openVendor() then 
        printf('  ERROR: Failed to open merchant window')
        crafting.FailedMessage = 'Could not open merchant'
        return false 
    end
    
    printf('  Merchant window opened successfully')
    
    printf('Step 4: Selling crafted items from bags...')
    local itemsSold = 0
    for i = 1, 10 do
        local bagSlot = mq.TLO.InvSlot('pack' .. i).Item
        local containerSize = bagSlot.Container()
        
        if containerSize then
            for j = 1, containerSize do
                local item = bagSlot.Item(j)
                if item.ID() then
                    if item.Name() == selectedRecipe.Recipe then
                        sellToVendor(item, i, j)
                        itemsSold = itemsSold + 1
                        mq.delay(250)
                    end
                end
            end
        end
    end
    
    printf('  Sold %d %s(s) - bags now have space!', itemsSold, selectedRecipe.Recipe)
    
    if mq.TLO.Window('MerchantWnd').Open() then 
        printf('Step 5: Closing merchant window...')
        mq.TLO.Window('MerchantWnd').DoClose() 
        mq.delay(250)
    end
    
    if selectedRecipe.Container and invSlotContainers[selectedRecipe.Container] then
        printf('Step 6: Checking crafting container: %s', selectedRecipe.Container)
        
        local containerItem = mq.TLO.FindItem('='..selectedRecipe.Container)
        if containerItem() then
            local containerSize = containerItem.Container()
            if containerSize and containerSize > 0 then
                local numItems = containerItem.Items()
                if numItems and numItems > 0 then
                    printf('  Emptying %d items from crafting container...', numItems)
                    printf('  (Bags now have space from selling, /autoinv should work!)')
                    
                    for slot = 1, containerSize do
                        local item = containerItem.Item(slot)
                        if item.ID() then
                            local itemName = item.Name()
                            
                            if mq.TLO.Cursor() then
                                printf('    WARNING: Cursor has item before pickup - clearing first')
                                local cleared = clearCursor(3)
                                if not cleared then
                                    printf('    ERROR: Could not clear cursor - stopping to prevent loss!')
                                    crafting.FailedMessage = 'Cursor stuck during container emptying'
                                    return false
                                end
                            end
                            
                            printf('    Moving %s from container slot %d', itemName, slot)
                            
                            mq.cmdf('/nomodkey /shiftkey /itemnotify "%s" leftmouseup', selectedRecipe.Container)
                            mq.delay(100)
                            mq.cmdf('/nomodkey /itemnotify in "%s" %d leftmouseup', selectedRecipe.Container, slot)
                            waitForCursor()
                            
                            mq.cmd('/autoinv')
                            mq.delay(500)
                            
                            if mq.TLO.Cursor() then
                                printf('    ERROR: "%s" did not /autoinv successfully!', itemName)
                                printf('    Trying to clear cursor to prevent loss...')
                                local cleared = clearCursor(5)
                                if not cleared then
                                    printf('    CRITICAL: Item stuck on cursor!')
                                    printf('    Stopping auto-sell to prevent item destruction')
                                    crafting.FailedMessage = 'Item stuck on cursor'
                                    return false
                                end
                            else
                                printf('    Successfully moved %s to inventory', itemName)
                            end
                        end
                    end
                    
                    printf('  Crafting container cleared successfully!')
                else
                    printf('  Crafting container is empty, nothing to move')
                end
            end
        end
    end
    
    printf('========================================')
    printf('AUTO-SELL COMPLETE')
    printf('Tradeskill window will reopen on next craft attempt')
    printf('========================================')
    return true
end

local function buy()
    if not selectedRecipe then buying.Status = false return end
    if invSlotContainers[selectedRecipe.Container] then
        if mq.TLO.FindItemCount('='..selectedRecipe.Container)() == 0 then
            local mat = recipes.Materials[selectedRecipe.Container]
            if not mat then
                printf('Container %s not available for purchase', selectedRecipe.Container)
                buying.Status = false
                return
            end
            if not mat.Location then
                printf('Container %s has no vendor location', selectedRecipe.Container)
                buying.Status = false
                return
            end
            mq.cmdf('/mqt %s', mat.Location)
            if not mq.TLO.Window('MerchantWnd').Open() or mq.TLO.Window('MerchantWnd/MW_MerchantName').Text() ~= mat.Location then
                if mq.TLO.Window('MerchantWnd').Open() then mq.TLO.Window('MerchantWnd').DoClose() mq.delay(50) mq.cmdf('/mqt %s', mat.Location) end
                if not goToVendor() then return end
                if not openVendor() then return end
                mq.delay(500)
            end
            printf('Buying %s', selectedRecipe.Container)
            RestockItems({[selectedRecipe.Container]=1})
            mq.TLO.Window('MerchantWnd').DoClose() mq.delay(250)
        end
    end
    local numMatsNeeded = {}
    for _,mat in ipairs(selectedRecipe.Materials) do
        numMatsNeeded[mat] = numMatsNeeded[mat] and numMatsNeeded[mat] + 1 or 1
    end
    
    local materialsByMerchant = {}
    local outOfZoneMaterials = {}  -- Track materials we can't buy in this zone
    
    for material,count in pairs(numMatsNeeded) do
        local mat = recipes.Materials[material]
        if mat and mat.SourceType == 'Vendor' then
            if mat.Zone and mq.TLO.Zone.ShortName() ~= mat.Zone then
                -- Material is in a different zone - can't buy here
                table.insert(outOfZoneMaterials, {
                    name = material,
                    zone = mat.Zone,
                    vendor = mat.Location,
                    count = count
                })
            else
                -- Material is in current zone or no zone specified
                local merchantName = mat.Location
                if not materialsByMerchant[merchantName] then
                    materialsByMerchant[merchantName] = {
                        tools = {},
                        nonTools = {}
                    }
                end
                
                if mat.Tool then
                    table.insert(materialsByMerchant[merchantName].tools, {
                        name = material,
                        count = count
                    })
                else
                    materialsByMerchant[merchantName].nonTools[material] = buying.Qty * count
                end
            end
        end
    end
    
    -- Warn about out-of-zone materials
    if #outOfZoneMaterials > 0 then
        printf('========================================')
        printf('WARNING: Some materials require travel!')
        printf('========================================')
        for _, item in ipairs(outOfZoneMaterials) do
            printf('  %s x%d - %s in %s', item.name, buying.Qty * item.count, item.vendor, item.zone)
        end
        printf('Travel to those zones to buy these items.')
        printf('========================================')
    end
    
    for merchantName, materials in pairs(materialsByMerchant) do
        if not buying.Status then return end
        
        printf('Going to merchant: %s', merchantName)
        mq.cmdf('/mqt %s', merchantName)
        
        if not mq.TLO.Window('MerchantWnd').Open() or mq.TLO.Window('MerchantWnd/MW_MerchantName').Text() ~= merchantName then
            if mq.TLO.Window('MerchantWnd').Open() then 
                mq.TLO.Window('MerchantWnd').DoClose() 
                mq.delay(50) 
                mq.cmdf('/mqt %s', merchantName) 
            end
            if not goToVendor() then return end
            if not openVendor() then return end
        end
        mq.delay(500)
        
        local nonToolCount = 0
        for _ in pairs(materials.nonTools) do nonToolCount = nonToolCount + 1 end
        
        if nonToolCount > 0 then
            printf('Buying %d non-tool items from %s:', nonToolCount, merchantName)
            for itemName, qty in pairs(materials.nonTools) do
                printf('  - %s %s(s)', qty, itemName)
            end
            RestockItems(materials.nonTools, false)
        end
        
        if #materials.tools > 0 then
            printf('Buying %d tool items from %s:', #materials.tools, merchantName)
            for _, toolInfo in ipairs(materials.tools) do
                printf('  - %s %s(s)', buying.Qty * toolInfo.count, toolInfo.name)
                RestockItems({[toolInfo.name] = buying.Qty * toolInfo.count}, true)
            end
        end
    end
    if mq.TLO.Window('MerchantWnd').Open() then mq.TLO.Window('MerchantWnd').DoClose() end
    buying.Status = false
end

local function sell()
    if not selectedRecipe then selling.Status = false return end
    
    if not mq.TLO.Window('MerchantWnd').Open() then
        printf('Manual Sell: Finding merchant...')
        mq.cmd('/mqt merchant')
        mq.delay(2000)
        
        local attempts = 0
        while not mq.TLO.Target() and attempts < 3 do
            attempts = attempts + 1
            printf('  Attempt %d: No target found, trying again...', attempts)
            mq.cmd('/mqt merchant')
            mq.delay(2000)
        end
        
        if not mq.TLO.Target() then
            printf('ERROR: Could not find merchant')
            selling.Status = false
            return
        end
        
        printf('  Merchant targeted: %s', mq.TLO.Target.CleanName())
        
        if not goToVendor() then 
            printf('ERROR: Could not reach merchant')
            selling.Status = false
            return 
        end
        if not openVendor() then 
            printf('ERROR: Could not open merchant window')
            selling.Status = false
            return 
        end
    end
    
    printf('Selling crafted items: %s', selectedRecipe.Recipe)
    local itemsSold = 0
    
    for i = 1, 10 do
        local bagSlot = mq.TLO.InvSlot('pack' .. i).Item
        local containerSize = bagSlot.Container()

        if containerSize then
            for j = 1, containerSize do
                if not selling.Status then return end
                local item = bagSlot.Item(j)
                if item.ID() then
                    if item.Name() == selectedRecipe.Recipe then
                        sellToVendor(item, i, j)
                        itemsSold = itemsSold + 1
                    end
                end
            end
        end
    end
    
    printf('Sold %d %s(s)', itemsSold, selectedRecipe.Recipe)
    
    if mq.TLO.Window('MerchantWnd').Open() then mq.TLO.Window('MerchantWnd').DoClose() end
    selling.Status = false
end

local function split(input)
    local sep = "|"
    local t={}
    for str in string.gmatch(input, "([^"..sep.."]+)") do
        table.insert(t, str)
    end
    return t
end

local function request()
    if not selectedRecipe then requesting.Status = false return end
    local peers = split(mq.TLO.DanNet.Peers())
    for _,peer in ipairs(peers) do
        if peer ~= mq.TLO.Me.CleanName() then
            for _,material in ipairs(selectedRecipe.Materials) do
                if not requesting.Status then return end
                printf('Requesting %s %s(s) from %s', buying.Qty, material, peer)
                mq.cmdf('/dex %s /giveit item pc %s "%s"', peer, mq.TLO.Me.CleanName(), material)
                mq.delay(1000)
            end
        end
    end
    requesting.Status = false
end

local function findOpenSlot(skip_slot)
    for i=23,32 do
        if i ~= skip_slot then
            local inv_slot = mq.TLO.Me.Inventory(i)
            if inv_slot.Container() and inv_slot.Container() - inv_slot.Items() > 0 then
                for j=1,inv_slot.Container() do
                    if not inv_slot.Item(j)() then return ('in Pack%s %s'):format(i-22, j) end
                end
            end
        end
    end
end

local function shouldCraft()
    if not selectedRecipe then 
        printf('No recipe selected') 
        return false 
    end
    
    if invSlotContainers[selectedRecipe.Container] then
        local containerCount = mq.TLO.FindItemCount('='..selectedRecipe.Container)()
        local containerItem = mq.TLO.FindItem('='..selectedRecipe.Container)
        
        if containerCount == 0 then
            printf('Recipe requires container: %s (not found)', selectedRecipe.Container)
            printf('Container needs to be purchased or obtained')
            crafting.FailedMessage = ('Missing container: %s - click "Buy Mats" to purchase'):format(selectedRecipe.Container)
            return false
        elseif containerItem.ItemSlot2() ~= -1 then
            printf('Recipe requires container in top level inventory slot: %s', selectedRecipe.Container)
            crafting.FailedMessage = ('Container must be in top level inventory slot: %s'):format(selectedRecipe.Container)
            return false
        end
    end
    
    local numMatsNeeded = {}
    for _,mat in ipairs(selectedRecipe.Materials) do
        numMatsNeeded[mat] = numMatsNeeded[mat] and numMatsNeeded[mat] + 1 or 1
    end
    
    local maxCombines = 999999
    
    for mat, count in pairs(numMatsNeeded) do
        local matOrSubcombine = nil
        
        if recipes.Subcombines[mat] then
            matOrSubcombine = recipes.Subcombines[mat]
        elseif recipes.Materials[mat] then
            matOrSubcombine = recipes.Materials[mat]
        else
            printf('Unknown component: %s', mat)
            crafting.FailedMessage = ('Unknown component: %s'):format(mat)
            return false
        end
        
        if matOrSubcombine.Tool then
            if mq.TLO.FindItemCount('='..mat)() == 0 then
                printf('Missing tool: %s', mat)
                crafting.FailedMessage = ('Missing tool: %s'):format(mat)
                return false
            end
        else
            local itemCount = mq.TLO.FindItemCount('='..mat)()
            if itemCount == 0 then
                itemCount = mq.TLO.FindItemCount(mat)()
            end
            
            local possibleCombines = math.floor(itemCount / count)
            maxCombines = math.min(possibleCombines, maxCombines)
            
            printf('%s: have %d, need %d per combine, can make %d', mat, itemCount, count, possibleCombines)
        end
    end
    
    if maxCombines == 0 or maxCombines == 999999 then
        printf('No materials available for crafting')
        crafting.FailedMessage = 'Insufficient materials'
        return false
    end
    
    maxPossibleCombines = maxCombines
    printf('Max possible combines with current materials: %d', maxCombines)
    printf('Current Qty setting: %d', buying.Qty)
    
    crafting.FailedMessage = nil
    return true
end

local function craftInExperimental(pack)
    if not selectedRecipe then 
        printf('ERROR: craftInExperimental called but no recipe selected')
        return 
    end
    
    printf('===========================================')
    printf('EXPERIMENTAL CRAFTING MODE')
    printf('  Recipe: %s', selectedRecipe.Recipe)
    printf('  Pack: %s', pack)
    printf('  Materials needed: %d', #selectedRecipe.Materials)
    printf('===========================================')
    
    printf('Clicking Experiment button...')
    mq.cmd('/notify TradeskillWnd COMBW_ExperimentButton leftmouseup')
    mq.delay(500)
    
    printf('Opening inventory bags...')
    mq.cmdf('/keypress OPEN_INV_BAGS')
    mq.delay(500)
    
    crafting.NumMade = 0
    printf('Starting experimental combines (target: %d)', buying.Qty)
    
    while crafting.NumMade < buying.Qty do
        if not crafting.Status then 
            printf('Crafting stopped (status false)')
            return 
        end
        
        if crafting.StopAtTrivial and (mq.TLO.Me.Skill(selectedTradeskill or '')() >= selectedRecipe.Trivial or mq.TLO.Me.Skill(selectedTradeskill or '')() == 300) then
            crafting.SuccessMessage = 'Reached trivial for recipe!'
            printf('Reached trivial - stopping')
            return
        end
        
        if mq.TLO.Me.FreeInventory() == 0 then
            if crafting.AutoSell then
                printf('Inventory full - auto-selling...')
                if autoSellCraftedItems() then
                    printf('Auto-sell complete, checking window state...')
                    
                    if not mq.TLO.Window('TradeskillWnd').Open() then
                        printf('  Tradeskill window closed, reopening...')
                        
                        if not reopenContainerWithRetry(selectedRecipe.Container, pack) then
                            crafting.FailedMessage = 'Could not reopen container after auto-sell'
                            return
                        end
                        
                        printf('  Clicking Experiment button...')
                        mq.cmd('/notify TradeskillWnd COMBW_ExperimentButton leftmouseup')
                        mq.delay(500)
                        mq.cmdf('/keypress OPEN_INV_BAGS')
                        mq.delay(500)
                    end
                    
                    printf('  Ready to continue experimental crafting')
                else
                    crafting.FailedMessage = 'Auto-sell failed!'
                    printf('Auto-sell failed - stopping')
                    return
                end
            else
                crafting.FailedMessage = 'Inventory is full!'
                printf('Inventory full - stopping')
                return
            end
        end
        
        printf('Combine %d/%d - Placing materials...', crafting.NumMade + 1, buying.Qty)
        
        -- Ensure cursor is empty before starting material placement
        if not ensureCursorEmpty() then
            printf('  ERROR: Could not clear cursor before placing materials')
            crafting.FailedMessage = 'Cursor stuck before material placement'
            return
        end
        
        for i, mat in ipairs(selectedRecipe.Materials) do
            printf('  Placing material %d: %s', i, mat)
            
            -- Verify cursor empty before each material
            if mq.TLO.Cursor() then 
                printf('    WARNING: Cursor has item before pickup, clearing...')
                if not clearCursor(5) then
                    printf('    ERROR: Could not clear cursor')
                    crafting.FailedMessage = 'Cursor stuck during material placement'
                    return
                end
            end
            
            mq.cmdf('/nomodkey /ctrlkey /itemnotify "%s" leftmouseup', mat)
            waitForCursor()
            
            if pack == 'Enviro' then
                if mq.TLO.Cursor() then 
                    printf('    Placing in enviro slot %d', i)
                    mq.cmdf('/itemnotify enviro%s leftmouseup', i) 
                end
            else
                if mq.TLO.Cursor() then 
                    printf('    Placing in pack%s slot %d', pack, i)
                    mq.cmdf('/itemnotify in %s %s leftmouseup', pack, i) 
                end
            end
            
            waitForEmptyCursor()
        end
        
        printf('  Performing combine...')
        mq.cmdf('/combine %s', pack)
        
        -- Wait for combine to process then thoroughly clear cursor
        mq.delay(1000)
        local success, itemsCleared = clearCursorAfterCombine(selectedRecipe.Recipe)
        
        if not success then
            printf('  ERROR: Could not clear cursor after combine')
            crafting.FailedMessage = 'Cursor stuck after combine - inventory may be full'
            return
        end
        
        crafting.NumMade = crafting.NumMade + 1
        printf('  Combine complete! Total made: %d', crafting.NumMade)
        
        if mq.TLO.Me.FreeInventory() == 0 or (selectedRecipe.Container and invSlotContainers[selectedRecipe.Container]) then
            local containerHasItems = false
            if selectedRecipe.Container and invSlotContainers[selectedRecipe.Container] then
                local containerItem = mq.TLO.FindItem('='..selectedRecipe.Container)
                if containerItem() then
                    local numItems = containerItem.Items()
                    if numItems and numItems > 0 then
                        containerHasItems = true
                        printf('  WARNING: %d items detected in crafting container!', numItems)
                    end
                end
            end
            
            if containerHasItems or mq.TLO.Me.FreeInventory() == 0 then
                if crafting.AutoSell then
                    printf('  Inventory full or container has items - auto-selling...')
                    if autoSellCraftedItems() then
                        printf('  Auto-sell complete, checking window state...')
                        
                        if not mq.TLO.Window('TradeskillWnd').Open() then
                            printf('  Tradeskill window closed, reopening...')
                            
                            if not reopenContainerWithRetry(selectedRecipe.Container, pack) then
                                crafting.FailedMessage = 'Could not reopen container after auto-sell'
                                return
                            end
                            
                            printf('  Clicking Experiment button...')
                            mq.cmd('/notify TradeskillWnd COMBW_ExperimentButton leftmouseup')
                            mq.delay(500)
                            mq.cmdf('/keypress OPEN_INV_BAGS')
                            mq.delay(500)
                        end
                        
                        printf('  Ready to continue experimental crafting')
                    else
                        crafting.FailedMessage = 'Auto-sell failed!'
                        printf('  Auto-sell failed - stopping')
                        return
                    end
                else
                    crafting.FailedMessage = 'Inventory is full!'
                    printf('  Inventory full - stopping')
                    return
                end
            end
        end
    end
    
    printf('===========================================')
    printf('EXPERIMENTAL CRAFTING COMPLETE')
    printf('  Total crafted: %d', crafting.NumMade)
    printf('===========================================')
end

local function craftInTradeskillWindow(pack)
    if not selectedRecipe then return end
    
    printf('Opening tradeskill window for recipe: %s', selectedRecipe.Recipe)
    
    local recipeExists = mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').List(selectedRecipe.Recipe)()
    
    if not recipeExists then
        printf('Recipe not in list, searching...')
        mq.cmd('/nomodkey /notify TradeskillWnd COMBW_SearchTextEdit leftmouseup')
        mq.delay(50)
        mq.TLO.Window('TradeskillWnd/COMBW_SearchTextEdit').SetText(selectedRecipe.Recipe)()
        mq.delay(50)
        
        mq.delay(30000, function() return mq.TLO.Window('TradeskillWnd/COMBW_SearchButton').Enabled() end)
        mq.cmd('/nomodkey /notify TradeskillWnd COMBW_SearchButton leftmouseup')
        mq.delay(1000)
        
        local listSize = mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').Items()
        
        if listSize == 0 then
            printf('No search results - using EXPERIMENTAL mode')
            craftInExperimental(pack)
            return
        end
        
        local exactMatches = {}
        local vendorMatches = {}
        printf('Search returned %d results, looking for exact matches: "%s"', listSize, selectedRecipe.Recipe)
        
        for i = 1, listSize do
            local recipeName = mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').List(i)()
            printf('  [%d] %s', i, recipeName)
            
            -- Check for exact match first
            if recipeName == selectedRecipe.Recipe then
                table.insert(exactMatches, i)
                printf('  -> EXACT MATCH at index %d', i)
            -- Check if recipe name matches after stripping common suffixes
            else
                local baseRecipeName = recipeName:gsub(' %(vendor%)', ''):gsub(' %(dropped%)', ''):gsub(' %(ground%)', '')
                if baseRecipeName == selectedRecipe.Recipe then
                    table.insert(exactMatches, i)
                    printf('  -> MATCH (after stripping suffix) at index %d', i)
                    
                    -- Track (vendor) versions separately - prefer these
                    if recipeName:match(' %(vendor%)') then
                        table.insert(vendorMatches, i)
                        printf('     -> Vendor version found')
                    end
                end
            end
        end
        
        -- Prefer vendor version if available
        if #vendorMatches > 0 then
            printf('Using vendor version at index %d', vendorMatches[1])
            mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').Select(vendorMatches[1])()
            mq.delay(200)
        elseif #exactMatches == 1 then
            printf('Single exact match found at index %d', exactMatches[1])
            mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').Select(exactMatches[1])()
            mq.delay(200)
        elseif #exactMatches > 1 then
            printf('MULTIPLE recipes with same name (%d matches) - using EXPERIMENTAL mode', #exactMatches)
            printf('  Different variants exist (different materials) - experimental will use your inventory')
            craftInExperimental(pack)
            return
        else
            printf('No exact match found - using EXPERIMENTAL mode')
            craftInExperimental(pack)
            return
        end
    else
        printf('Recipe already in list, checking for duplicates...')
        local listSize = mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').Items()
        local exactMatches = {}
        
        for i = 1, listSize do
            local recipeName = mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').List(i)()
            if recipeName == selectedRecipe.Recipe then
                table.insert(exactMatches, i)
            end
        end
        
        if #exactMatches > 1 then
            printf('MULTIPLE recipes with same name (%d matches) - using EXPERIMENTAL mode', #exactMatches)
            craftInExperimental(pack)
            return
        elseif #exactMatches == 1 then
            mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').Select(exactMatches[1])()
            mq.delay(200)
        end
    end
    
    if selectedTradeskill == 'Jewelry Making' and recipeExists and recipeExists > 0 then
        local nextRecipe = mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').List(recipeExists+1)()
        if nextRecipe == selectedRecipe.Recipe then
            mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').Select(recipeExists+1)()
        end
    end
    
    printf('=== CRAFTING LOOP DEBUG ===')
    printf('buying.Qty = %d', buying.Qty)
    printf('crafting.Status = %s', tostring(crafting.Status))
    printf('crafting.NumMade = %d', crafting.NumMade)
    printf('crafting.Fast = %s', tostring(crafting.Fast))
    
    crafting.NumMade = 0
    
    printf('Entering while loop...')
    while crafting.NumMade < buying.Qty do
        printf('Loop iteration %d (target: %d)', crafting.NumMade + 1, buying.Qty)
        
        if not crafting.Status then 
            printf('STOPPED: crafting.Status is false')
            return 
        end
        printf('  Check 1: Status OK')
        
        if crafting.StopAtTrivial and (mq.TLO.Me.Skill(selectedTradeskill or '')() >= selectedRecipe.Trivial or mq.TLO.Me.Skill(selectedTradeskill or '')() == 300) then
            crafting.SuccessMessage = 'Reached trivial for recipe!'
            printf('STOPPED: Reached trivial')
            return
        end
        printf('  Check 2: Trivial OK')
        
        if mq.TLO.Me.FreeInventory() == 0 then
            if crafting.AutoSell then
                printf('INVENTORY FULL: Auto-selling...')
                if autoSellCraftedItems() then
                    printf('Auto-sell complete, reopening tradeskill window...')
                    
                    if not reopenContainerWithRetry(selectedRecipe.Container, pack) then
                        crafting.FailedMessage = 'Could not reopen container after auto-sell'
                        return
                    end
                    
                    printf('  Window reopened, searching for recipe...')
                    mq.cmd('/nomodkey /notify TradeskillWnd COMBW_SearchTextEdit leftmouseup')
                    mq.delay(100)
                    mq.TLO.Window('TradeskillWnd/COMBW_SearchTextEdit').SetText(selectedRecipe.Recipe)()
                    mq.delay(100)
                    mq.delay(5000, function() return mq.TLO.Window('TradeskillWnd/COMBW_SearchButton').Enabled() end)
                    mq.cmd('/nomodkey /notify TradeskillWnd COMBW_SearchButton leftmouseup')
                    mq.delay(1000)
                    
                    local listSize = mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').Items()
                    if listSize > 0 then
                        for i = 1, listSize do
                            local recipeName = mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').List(i)()
                            if recipeName == selectedRecipe.Recipe then
                                printf('  Selecting recipe at index %d', i)
                                mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').Select(i)()
                                mq.delay(1000)
                                break
                            end
                        end
                    end
                    
                    mq.delay(2000, function() return mq.TLO.Window('TradeskillWnd/CombineButton').Enabled() end)
                    if mq.TLO.Window('TradeskillWnd/CombineButton').Enabled() then
                        printf('  Ready to continue crafting')
                    else
                        printf('  WARNING: Combine button not ready, stopping')
                        crafting.FailedMessage = 'Could not resume after auto-sell'
                        return
                    end
                else
                    crafting.FailedMessage = 'Auto-sell failed!'
                    printf('STOPPED: Auto-sell failed')
                    return
                end
            else
                crafting.FailedMessage = 'Inventory is full!'
                printf('STOPPED: Inventory full')
                return
            end
        end
        printf('  Check 3: Inventory OK')
        
        if not crafting.Fast then
            printf('  Clearing cursor...')
            clearCursor()
            printf('  Waiting for combine button...')
            mq.delay(1000, function() return mq.TLO.Window('TradeskillWnd/CombineButton').Enabled() end)
        end
        
        local buttonEnabled = mq.TLO.Window('TradeskillWnd/CombineButton').Enabled()
        printf('  Combine button enabled: %s', tostring(buttonEnabled))
        
        if buttonEnabled then
            printf('  CLICKING COMBINE BUTTON')
            mq.cmdf('/nomodkey /notify TradeskillWnd CombineButton leftmouseup')
            
            if not crafting.Fast then
                printf('  Waiting for combine result...')
                mq.delay(1000)  -- Initial delay for combine to process
                
                -- Use thorough cursor clearing that handles tools and salvage
                local success, itemsCleared = clearCursorAfterCombine(selectedRecipe.Recipe)
                
                if not success then
                    printf('  ERROR: Could not clear cursor after combine')
                    crafting.FailedMessage = 'Cursor stuck after combine - inventory may be full'
                    return
                end
                
                printf('  Doing events...')
                mq.doevents()
                
                -- Verify materials are actually missing before stopping
                if crafting.OutOfMats then
                    -- Double-check by verifying combine button after longer delay for tools
                    mq.delay(1500)  -- Longer wait for tools to return to inventory
                    
                    -- One more cursor check in case tool arrived late
                    if mq.TLO.Cursor() then
                        printf('  Late item on cursor detected, clearing...')
                        clearCursorAfterCombine(selectedRecipe.Recipe)
                    end
                    
                    mq.delay(500)   -- Final UI update delay
                    local combineEnabled = mq.TLO.Window('TradeskillWnd/CombineButton').Enabled()
                    if not combineEnabled then
                        printf('STOPPED: Out of materials (verified - combine button disabled)')
                        break
                    else
                        printf('  False "out of materials" - materials available, continuing')
                        crafting.OutOfMats = false
                    end
                else
                    crafting.OutOfMats = false
                end
            else
                -- Fast mode - still need to handle tools and multiple items
                mq.delay(250)  -- Brief delay for items to appear
                mq.cmd('/autoinv')
                mq.delay(250)
                mq.cmd('/autoinv')
                mq.delay(250)
                -- One more for tools that return after crafted item
                if mq.TLO.Cursor() then
                    mq.cmd('/autoinv')
                    mq.delay(250)
                end
            end
            
            crafting.NumMade = crafting.NumMade + 1
            printf('  Combine %d COMPLETE', crafting.NumMade)
            
            if mq.TLO.Me.FreeInventory() == 0 or (selectedRecipe.Container and invSlotContainers[selectedRecipe.Container]) then
                local containerHasItems = false
                if selectedRecipe.Container and invSlotContainers[selectedRecipe.Container] then
                    local containerItem = mq.TLO.FindItem('='..selectedRecipe.Container)
                    if containerItem() then
                        local numItems = containerItem.Items()
                        if numItems and numItems > 0 then
                            containerHasItems = true
                            printf('  WARNING: %d items detected in crafting container!', numItems)
                        end
                    end
                end
                
                if containerHasItems or mq.TLO.Me.FreeInventory() == 0 then
                    if crafting.AutoSell then
                        printf('  Inventory full or container has items - auto-selling...')
                        if autoSellCraftedItems() then
                            printf('  Auto-sell complete, reopening tradeskill window...')
                            
                            if not reopenContainerWithRetry(selectedRecipe.Container, pack) then
                                crafting.FailedMessage = 'Could not reopen container after auto-sell'
                                return
                            end
                            
                            printf('  Window reopened, searching for recipe...')
                            mq.cmd('/nomodkey /notify TradeskillWnd COMBW_SearchTextEdit leftmouseup')
                            mq.delay(100)
                            mq.TLO.Window('TradeskillWnd/COMBW_SearchTextEdit').SetText(selectedRecipe.Recipe)()
                            mq.delay(100)
                            mq.delay(5000, function() return mq.TLO.Window('TradeskillWnd/COMBW_SearchButton').Enabled() end)
                            mq.cmd('/nomodkey /notify TradeskillWnd COMBW_SearchButton leftmouseup')
                            mq.delay(1000)
                            
                            local listSize = mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').Items()
                            if listSize > 0 then
                                for i = 1, listSize do
                                    local recipeName = mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').List(i)()
                                    if recipeName == selectedRecipe.Recipe then
                                        printf('  Selecting recipe at index %d', i)
                                        mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').Select(i)()
                                        mq.delay(1000)
                                        break
                                    end
                                end
                            end
                            
                            mq.delay(2000, function() return mq.TLO.Window('TradeskillWnd/CombineButton').Enabled() end)
                            if mq.TLO.Window('TradeskillWnd/CombineButton').Enabled() then
                                printf('  Ready to continue crafting')
                            else
                                printf('  WARNING: Combine button not ready, stopping')
                                crafting.FailedMessage = 'Could not resume after auto-sell'
                                return
                            end
                        else
                            crafting.FailedMessage = 'Auto-sell failed!'
                            printf('  Auto-sell failed - stopping')
                            return
                        end
                    else
                        crafting.FailedMessage = 'Inventory is full!'
                        printf('  Inventory full - stopping')
                        return
                    end
                end
            end
        else
            printf('  ERROR: Combine button NOT enabled!')
            printf('  Window open: %s', tostring(mq.TLO.Window('TradeskillWnd').Open()))
            printf('  Recipe selected: %s', mq.TLO.Window('TradeskillWnd/COMBW_RecipeList').Value())
            clearCursor()
            mq.delay(500)
            buttonEnabled = mq.TLO.Window('TradeskillWnd/CombineButton').Enabled()
            if not buttonEnabled then
                printf('  Still not enabled after delay - STOPPING')
                return
            end
        end
    end
    
    printf('=== CRAFTING COMPLETE ===')
    printf('Total made: %d', crafting.NumMade)
end

local function craftInInvSlot()
    if not selectedRecipe then return end
    
    -- Determine container pack FIRST, before checking if window is open
    local container_item = mq.TLO.FindItem('='..selectedRecipe.Container)
    if not container_item() then
        printf('ERROR: Container %s not found', selectedRecipe.Container)
        return
    end
    
    local container_pack = container_item.ItemSlot() - 22
    
    if mq.TLO.Window('TradeskillWnd').Open() then
            craftInTradeskillWindow('pack'..container_pack)
            return
    end
    
    if container_item.ItemSlot2() ~= -1 then
        mq.cmdf('/nomodkey /ctrlkey /itemnotify "%s" leftmouseup', selectedRecipe.Container)
        waitForCursor()
        clearCursor()

        container_item = mq.TLO.FindItem('='..selectedRecipe)
        if container_item.ItemSlot2() ~= -1 then
            printf('No top level inventory slot available for container')
            return
        end
        container_pack = container_item.ItemSlot() - 22
    else
        if container_item.Items() > 0 then
            mq.cmdf('/keypress OPEN_INV_BAGS')
            for i=0,container_item.Container() do
                if container_item.Item(i)() then
                    local new_location = findOpenSlot(container_pack+22)
                    mq.cmdf('/nomodkey /shiftkey /itemnotify in pack%s %s leftmouseup', container_pack, i)
                    waitForCursor()
                    mq.cmdf('/itemnotify %s leftmouseup', new_location)
                    waitForEmptyCursor()
                end
            end
            mq.cmdf('/keypress CLOSE_INV_BAGS')
        end
    end
    if mq.TLO.Window('pack'..container_pack)() then mq.cmdf('/keypress CLOSE_INV_BAGS') mq.delay(1) mq.delay(100) end
    mq.cmdf('/itemnotify "pack%s" rightmouseup', container_pack)
    mq.delay(10)
    craftInTradeskillWindow('pack'..container_pack)
    clearCursor()
end

local function craftAtStation()
    if not selectedRecipe then return end
    printf('Moving to crafting station')
    
    mq.cmdf('/nav loc '..recipes.Stations[mq.TLO.Zone.ShortName()][selectedRecipe.Container]..' log=off')
    mq.delay(250)
    
    stuckDetection.reset()
    
    local navStartTime = os.clock()
    local maxNavTime = 30
    
    while mq.TLO.Navigation.Active() do
        if stuckDetection.checkIfStuck() then
            if not stuckDetection.performUnstuck() then
                crafting.FailedMessage = 'Could not navigate to station (stuck)'
                crafting.Status = false
                return
            end
        end
        
        if (os.clock() - navStartTime) > maxNavTime then
            printf('Navigation timeout')
            mq.cmd('/nav stop')
            break
        end
        
        mq.delay(100)
    end
    printf('Opening crafting station')
    mq.cmd('/itemtar')
    mq.delay(5)
    mq.cmd('/click left item')
    mq.delay(500, function() return mq.TLO.Window('TradeskillWnd').Open() end)
    if not mq.TLO.Window('TradeskillWnd').Open() then return end
    craftInTradeskillWindow('Enviro')
    clearCursor()
end

-- ============================================================================
-- CRAFT ALL HELPER FUNCTIONS
-- ============================================================================

-- Count total needs for each subcombine across entire recipe tree
local function countSubcombineNeeds(recipe, counts, processed)
    counts = counts or {}
    processed = processed or {}
    
    if processed[recipe.Recipe] then
        return counts
    end
    processed[recipe.Recipe] = true
    
    for _, material in ipairs(recipe.Materials) do
        local subcombine = recipes.Subcombines[material]
        
        if subcombine and not subcombine.Tool then
            counts[material] = (counts[material] or 0) + 1
            countSubcombineNeeds(subcombine, counts, processed)
        end
    end
    
    return counts
end

-- Build craft queue by recursively walking dependency tree
local function buildCraftQueue(recipe, queue, processed, depth)
    queue = queue or {}
    processed = processed or {}
    depth = depth or 0
    
    local indent = string.rep('  ', depth)
    printf('%s[QUEUE] %s', indent, recipe.Recipe)
    
    if processed[recipe.Recipe] then
        return queue
    end
    processed[recipe.Recipe] = true
    
    for _, material in ipairs(recipe.Materials) do
        local subcombine = recipes.Subcombines[material]
        
        if subcombine then
            if subcombine.Tool then
                printf('%s  SKIP tool: %s', indent, material)
            else
                printf('%s  SUB: %s', indent, material)
                
                if not processed[subcombine.Recipe] then
                    buildCraftQueue(subcombine, queue, processed, depth + 1)
                end
                
                table.insert(queue, {recipe = subcombine, name = material})
            end
        end
    end
    
    return queue
end

-- ============================================================================
-- CRAFT FUNCTION WITH CRAFT ALL SUPPORT
-- ============================================================================
local function craft()
    if not selectedRecipe or not shouldCraft() then 
        crafting.Status = false 
        return 
    end
    
    -- ========== CRAFT ALL MODE (buying.Qty == -1) ==========
    if buying.Qty == -1 then
        printf('===================================================')
        printf('CRAFT ALL ACTIVATED: %s', selectedRecipe.Recipe)
        printf('===================================================')
        
        -- Build queue
        craftQueue = buildCraftQueue(selectedRecipe, {}, {})
        
        if #craftQueue == 0 then
            printf('No subcombines needed, crafting main recipe')
            buying.Qty = 1
        else
            printf('Found %d subcombine entries', #craftQueue)
            
            -- Count total needs
            local needs = {}
            for i, item in ipairs(craftQueue) do
                needs[item.name] = (needs[item.name] or 0) + 1
            end
            
            printf('---------------------------------------------------')
            printf('INVENTORY CHECK:')
            for name, count in pairs(needs) do
                local have = mq.TLO.FindItemCount('='..name)()
                printf('  %s: need %d, have %d', name, count, have)
            end
            printf('---------------------------------------------------')
            
            -- Build unique queue with quantities
            local uniqueQueue = {}
            local seen = {}
            
            for i, item in ipairs(craftQueue) do
                if not seen[item.name] then
                    seen[item.name] = true
                    
                    local needed = needs[item.name]
                    local have = mq.TLO.FindItemCount('='..item.name)()
                    local shortage = needed - have
                    
                    if shortage > 0 then
                        table.insert(uniqueQueue, {
                            recipe = item.recipe,
                            name = item.name,
                            qtyNeeded = shortage
                        })
                        printf('[ADD] %s: craft %d', item.name, shortage)
                    else
                        printf('[SKIP] %s: have enough (%d >= %d)', item.name, have, needed)
                    end
                end
            end
            
            if #uniqueQueue == 0 then
                printf('All subcombines already in inventory!')
                buying.Qty = 1
            else
                printf('===================================================')
                printf('CRAFTING %d SUBCOMBINES', #uniqueQueue)
                printf('===================================================')
                
                -- Craft each subcombine
                for i, item in ipairs(uniqueQueue) do
                    printf('---------------------------------------------------')
                    printf('[%d/%d] CRAFTING: %s', i, #uniqueQueue, item.name)
                    printf('---------------------------------------------------')
                    
                    local originalRecipe = selectedRecipe
                    selectedRecipe = item.recipe
                    
                    if not shouldCraft() then
                        printf('ERROR: Missing materials for %s', item.name)
                        crafting.Status = false
                        crafting.FailedMessage = 'Missing materials for ' .. item.name
                        selectedRecipe = originalRecipe
                        return
                    end
                    
                    local originalQty = buying.Qty
                    local originalStopAtTrivial = crafting.StopAtTrivial
                    
                    -- Check if tool ingredient
                    local toolIngredients = {'Metal Bits', 'Small Piece of Ore', 'Ceramic Lining', 
                                            'Unfired Ceramic Lining', 'Water Flask', 'File Mold', 
                                            'Scaler Mold', 'Cake Round Mold'}
                    local isToolIng = false
                    for _, ti in ipairs(toolIngredients) do
                        if item.name == ti then
                            isToolIng = true
                            break
                        end
                    end
                    
                    local canMake = maxPossibleCombines or 999
                    
                    if isToolIng then
                        buying.Qty = math.min(item.qtyNeeded, canMake)
                        printf('Strategy: SHORTAGE ONLY (tool ingredient)')
                        printf('Will craft: %d', buying.Qty)
                    else
                        buying.Qty = canMake
                        printf('Strategy: MAXIMIZE (regular subcombine)')
                        printf('Needed: %d, Can make: %d, Will craft: %d', item.qtyNeeded, canMake, buying.Qty)
                    end
                    
                    crafting.StopAtTrivial = false
                    
                    -- Craft it
                    if recipes.Stations[mq.TLO.Zone.ShortName()] and recipes.Stations[mq.TLO.Zone.ShortName()][selectedRecipe.Container] then
                        craftAtStation()
                    elseif invSlotContainers[selectedRecipe.Container] then
                        craftInInvSlot()
                    else
                        -- Check if the container is a station in another zone
                        local foundInZone = nil
                        for zoneName, stations in pairs(recipes.Stations) do
                            if stations[selectedRecipe.Container] then
                                foundInZone = zoneName
                                break
                            end
                        end
                        
                        if foundInZone then
                            printf('ERROR: %s requires %s (in %s)', selectedRecipe.Recipe, selectedRecipe.Container, foundInZone)
                            printf('Travel to %s to craft this subcombine.', foundInZone)
                            crafting.FailedMessage = 'Station not in this zone - go to ' .. foundInZone
                        else
                            printf('ERROR: Unknown container: %s', selectedRecipe.Container)
                        end
                        crafting.Status = false
                        selectedRecipe = originalRecipe
                        buying.Qty = originalQty
                        crafting.StopAtTrivial = originalStopAtTrivial
                        return
                    end
                    
                    buying.Qty = originalQty
                    crafting.StopAtTrivial = originalStopAtTrivial
                    selectedRecipe = originalRecipe
                    
                    if crafting.OutOfMats then
                        printf('ERROR: Ran out of materials')
                        crafting.Status = false
                        return
                    end
                    
                    printf('COMPLETED: %s', item.name)
                    mq.delay(500)
                end
                
                printf('===================================================')
                printf('ALL SUBCOMBINES COMPLETE!')
                printf('Now crafting main recipe: %s', selectedRecipe.Recipe)
                printf('===================================================')
            end
            
            buying.Qty = 1
        end
    end
    -- ========== END CRAFT ALL MODE ==========
    
    -- Normal crafting
    clearCursor()
    if recipes.Stations[mq.TLO.Zone.ShortName()] and recipes.Stations[mq.TLO.Zone.ShortName()][selectedRecipe.Container] then
        craftAtStation()
    elseif invSlotContainers[selectedRecipe.Container] then
        craftInInvSlot()
    else
        -- Check if the container is a station in another zone
        local foundInZone = nil
        for zoneName, stations in pairs(recipes.Stations) do
            if stations[selectedRecipe.Container] then
                foundInZone = zoneName
                break
            end
        end
        
        if foundInZone then
            printf('========================================')
            printf('ERROR: Crafting station not in this zone!')
            printf('========================================')
            printf('  Recipe: %s', selectedRecipe.Recipe)
            printf('  Requires: %s', selectedRecipe.Container)
            printf('  Available in: %s', foundInZone)
            printf('  Current zone: %s', mq.TLO.Zone.ShortName())
            printf('========================================')
            printf('Travel to %s to craft this recipe.', foundInZone)
            crafting.FailedMessage = 'Station not in this zone - go to ' .. foundInZone
        else
            printf('========================================')
            printf('ERROR: Unknown crafting container!')
            printf('========================================')
            printf('  Recipe: %s', selectedRecipe.Recipe)
            printf('  Container: %s', selectedRecipe.Container)
            printf('  This container is not defined in recipes.')
            crafting.FailedMessage = 'Unknown container: ' .. selectedRecipe.Container
        end
    end
    clearCursor()
    crafting.Status = false
end

for name,ingredient in pairs(recipes.Materials) do
    table.insert(ingredientsArray, {Name=name, Location=ingredient.Location, SourceType=ingredient.SourceType, Tool=ingredient.Tool, Zone=ingredient.Zone})
end
table.sort(ingredientsArray, function(a,b) return a.Name < b.Name end)

mq.imgui.init('radix', radixGUI)

mq.event('missingmaterial', '#*#You are missing a#*#', function() crafting.OutOfMats = true end)
while true do
    if selectedRecipe then
        if buying.Status then
            buy()
        elseif selling.Status then
            sell()
        elseif requesting.Status then
            request()
        elseif crafting.Status then
            craft()
        end
    end
    mq.delay(1000)
end