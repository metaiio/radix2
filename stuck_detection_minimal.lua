-- ============================================================================
-- STUCK DETECTION MODULE - ADD THIS TO TOP OF init.lua
-- This is the ONLY addition needed - your craft functions stay unchanged
-- ============================================================================

local stuckDetection = {
    lastPos = {x = 0, y = 0, z = 0},
    lastMoveTime = os.clock() * 1000,
    stuckCount = 0,
    maxStuckAttempts = 3,
    checkInterval = 100, -- Check every 100ms
    stuckTimeThreshold = 5000, -- 5 seconds without movement = stuck
    movementThreshold = 3 -- Must move 3+ units to count as "moving"
}

function stuckDetection.reset()
    stuckDetection.lastPos = {x = mq.TLO.Me.X(), y = mq.TLO.Me.Y(), z = mq.TLO.Me.Z()}
    stuckDetection.lastMoveTime = os.clock() * 1000
    stuckDetection.stuckCount = 0
end

function stuckDetection.checkIfStuck()
    if not mq.TLO.Navigation.Active() then return false end
    
    local currentPos = {x = mq.TLO.Me.X(), y = mq.TLO.Me.Y(), z = mq.TLO.Me.Z()}
    local distance = math.sqrt(
        (currentPos.x - stuckDetection.lastPos.x)^2 + 
        (currentPos.y - stuckDetection.lastPos.y)^2 + 
        (currentPos.z - stuckDetection.lastPos.z)^2
    )
    
    local currentTime = os.clock() * 1000
    
    -- If we moved enough, reset timer
    if distance > stuckDetection.movementThreshold then
        stuckDetection.lastPos = currentPos
        stuckDetection.lastMoveTime = currentTime
        return false
    end
    
    -- Check if stuck long enough
    if (currentTime - stuckDetection.lastMoveTime) > stuckDetection.stuckTimeThreshold then
        return true
    end
    
    return false
end

function stuckDetection.performUnstuck()
    stuckDetection.stuckCount = stuckDetection.stuckCount + 1
    
    if stuckDetection.stuckCount > stuckDetection.maxStuckAttempts then
        printf('⚠ Max unstuck attempts reached - stopping navigation')
        mq.cmd('/nav stop')
        return false
    end
    
    printf('🔧 STUCK DETECTED - Attempting unstuck method %d/%d', stuckDetection.stuckCount, stuckDetection.maxStuckAttempts)
    
    -- Pause navigation (not stop - we want to resume)
    mq.cmd('/nav pause')
    mq.delay(100)
    
    -- Unstuck method based on attempt number
    if stuckDetection.stuckCount == 1 then
        -- Method 1: Back up
        printf('  → Backing up...')
        mq.cmd('/keypress back hold')
        mq.delay(1500)
        mq.cmd('/keypress back')
    elseif stuckDetection.stuckCount == 2 then
        -- Method 2: Turn and forward
        printf('  → Turning and moving forward...')
        mq.cmd('/keypress forward hold')
        mq.cmd('/keypress left hold')
        mq.delay(1000)
        mq.cmd('/keypress forward')
        mq.cmd('/keypress left')
    else
        -- Method 3: Random direction
        printf('  → Random direction...')
        local directions = {'forward', 'back', 'strafeleft', 'straferight'}
        local dir = directions[math.random(#directions)]
        mq.cmd('/keypress '..dir..' hold')
        mq.delay(1500)
        mq.cmd('/keypress '..dir)
    end
    
    mq.delay(200)
    
    -- Resume navigation
    mq.cmd('/nav pause')
    mq.delay(100)
    
    -- Reset position tracking
    stuckDetection.lastPos = {x = mq.TLO.Me.X(), y = mq.TLO.Me.Y(), z = mq.TLO.Me.Z()}
    stuckDetection.lastMoveTime = os.clock() * 1000
    
    printf('  ✓ Unstuck complete - resuming navigation')
    return true
end

-- ============================================================================
-- YOUR EXISTING craftAtStation() FUNCTION WITH MINIMAL CHANGES
-- Only the navigation loop is modified - everything else stays the same
-- ============================================================================

local function craftAtStation()
    if not selectedRecipe then return end
    
    printf('Moving to crafting station')
    
    -- Reset stuck detection before starting navigation
    stuckDetection.reset()
    
    -- START NAVIGATION (your original code)
    mq.cmdf('/nav loc '..recipes.Stations[mq.TLO.Zone.ShortName()][selectedRecipe.Container]..' log=off')
    mq.delay(250)
    
    -- MODIFIED NAVIGATION LOOP - adds stuck checking
    local navStartTime = os.clock()
    local maxNavTime = 30 -- 30 second timeout
    
    while mq.TLO.Navigation.Active() do
        -- Check if stuck
        if stuckDetection.checkIfStuck() then
            if not stuckDetection.performUnstuck() then
                -- Max attempts reached, stop trying
                crafting.FailedMessage = 'Could not navigate to station (stuck)'
                crafting.Status = false
                return
            end
        end
        
        -- Timeout check
        if (os.clock() - navStartTime) > maxNavTime then
            printf('Navigation timeout after %d seconds', maxNavTime)
            mq.cmd('/nav stop')
            crafting.FailedMessage = 'Navigation timeout'
            crafting.Status = false
            return
        end
        
        mq.delay(100) -- Check every 100ms
    end
    
    -- REST OF YOUR FUNCTION UNCHANGED
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
-- THAT'S IT - YOUR OTHER FUNCTIONS STAY EXACTLY THE SAME:
-- - shouldCraft()
-- - craftInExperimental()
-- - craftInTradeskillWindow()  <-- THIS ONE WORKS, DON'T TOUCH IT
-- - craftInInvSlot()
-- - craft()
-- ============================================================================
