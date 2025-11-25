-- EverQuest Tradeskill Recipe Database
-- Enhanced version with complete skill-up paths, vendor locations, and dependencies
-- Compatible with MacroQuest tradeskill automation

return {
    -- ================================================================
    -- RECIPE DEFINITIONS BY TRADESKILL
    -- ================================================================
    
    ['Baking'] = {
        -- 0-54: Use Abysmal Sea or Crescent Reach Starter Quests (FREE)
        
        -- 54-191: Patty Melts (Vendor-bought, No Sub-combines)
        {
            Recipe='Patty Melt',
            Trivial=191,
            Materials={'Cheese','Non-Stick Frying Pan','Loaf of Bread','Bear Meat'},
            Container='Oven',
            SkillRange={54,191},
            Notes='Non-Stick Frying Pan requires smithing (Jaggedpine Forest)',
        },
        
        -- 191-300: Dreamburger Paradise or Expansion Ingredients
        {
            Recipe='Dreamburger Paradise',
            Trivial=280,
            Materials={'Dream Meat','Bun','Lettuce','Cheese','Tomato'},
            Container='Oven',
            SkillRange={191,300},
            Notes='Requires Dream Meat sub-combine',
        },
        
        -- Alternative: Expansion Ingredient Path
        {
            Recipe='Burning Salad',
            Trivial=270,
            Materials={'Lettuce','Relic Fragment','Oil Dressing'},
            Container='Oven',
            SkillRange={191,300},
            Notes='No sub-combines, uses TDS expansion ingredient',
        },
        
        {
            Recipe='Enchanted Sugar Cakes',
            Trivial=285,
            Materials={'Cup of Flour','Relic Fragment','Basilisk Eggs','Frosting'},
            Container='Oven',
            SkillRange={191,300},
            Notes='No sub-combines, uses TDS expansion ingredient',
        },
        
        -- High Level Picnic (300+)
        {
            Recipe='Misty Thicket Picnic',
            Trivial=335,
            Materials={'Marmalade Sandwich','Jumjum Salad','Royal Mints','Slice of Jumjum Cake','Slice of Jumjum Cake','Mature Cheese','Picnic Basket','Jumjum Spiced Beer'},
            Container='Oven',
            SkillRange={300,350},
            Notes='Multiple sub-combines required',
        },
        
        -- Sub-Combines for Baking
        {
            Recipe='Fish Rolls',
            Trivial=135,
            Materials={'Fresh Fish','Bat Wing'},
            Container='Oven',
            SkillRange={100,150},
            Notes='Good skill-up alternative',
        },
        
        {
            Recipe='Celestial Essence',
            Trivial=15,
            Materials={'Concentrated Celestial Solvent','The Scent of Marr'},
            Container='Mixing Bowl',
            SkillRange={1,50},
            Yields=3,
            Notes='Makes 3, used for smithing (Embroidering Needle)',
        },
    },
    
    ['Blacksmithing'] = {
        -- 0-54: Use Abysmal Sea or Crescent Reach Starter Quests (FREE)
        
        -- Basic Smithing Components (Used by multiple recipes)
        {
            Recipe='Metal Bits',
            Trivial=18,
            Materials={'Small Piece of Ore','Small Piece of Ore','Water Flask'},
            Container='Forge',
            SkillRange={1,50},
            Notes='Component for many recipes, very cheap',
        },
        
        {
            Recipe='File',
            Trivial=21,
            Materials={'File Mold','Metal Bits','Water Flask'},
            Container='Forge',
            SkillRange={1,50},
            Notes='Tool that returns on combine',
            ReturnsOnCombine=true,
        },
        
        {
            Recipe='Velium Bits',
            Trivial=21,
            Materials={'Small Piece of Velium','Small Piece of Velium','Coldain Velium Temper'},
            Container='Forge',
            SkillRange={1,50},
            Notes='Used for Velium Studs',
        },
        
        {
            Recipe='Velium Studs',
            Trivial=43,
            Materials={'Velium Bits','Velium Bits','Velium Bits','Coldain Velium Temper','File'},
            Container='Forge',
            SkillRange={30,100},
            Notes='Essential for tailoring studded armor, File returns',
        },
        
        -- 54-100: Banded Bracers
        {
            Recipe='Banded Bracers',
            Trivial=86,
            Materials={'Sheet of Metal','Bracer Mold','Water Flask'},
            Container='Forge',
            SkillRange={54,100},
            Notes='All vendor-bought components',
        },
        
        -- 100-300: Progressive Metal Types
        {
            Recipe='Ethereal Metal Rings',
            Trivial=212,
            Materials={'Brick of Ethereal Energy','Ethereal Temper','File'},
            Container='Forge',
            SkillRange={180,230},
            Notes='Planes of Power drops required',
        },
        
        -- Cultural Templates
        {
            Recipe='Rhenium Chain Collar Template',
            Trivial=272,
            Materials={'Black Nitrous Coal','Smithy Hammer','Chainmail Collar Template Pattern','Metal Tempering Chemicals','Rhenium Ore'},
            Container='Forge',
            SkillRange={240,300},
            Notes='Cultural armor template, HC Low-Mid drops',
        },
        
        {
            Recipe='Tungsten Chain Collar Template',
            Trivial=310,
            Materials={'Lustrous Black Coal','Smithy Hammer','Chainmail Collar Template Pattern','Metal Tempering Chemicals','Tungsten Ore'},
            Container='Forge',
            SkillRange={280,335},
            Notes='Cultural armor template, HC Mid-High drops',
        },
        
        -- Advanced Smithing (for Tailoring)
        {
            Recipe='Embroidering Needle',
            Trivial=122,
            Materials={'Celestial Essence','Concentrated Celestial Solvent','The Scent of Marr','The Scent of Marr','The Scent of Marr','Metal Bits','Needle Mold','Water Flask','Gem Studded Chain'},
            Container='Forge',
            SkillRange={100,150},
            Notes='Requires Baking (Celestial Essence) and Jewelcrafting (Gem Studded Chain)',
        },
        
        -- Non-Stick Frying Pan (for Baking)
        {
            Recipe='Non-Stick Frying Pan',
            Trivial=85,
            Materials={'Frying Pan Mold','Small Piece of Ore','Quality Firing Sheet','Water Flask'},
            Container='Forge',
            SkillRange={70,110},
            Notes='Essential tool for Baking, Frying Pan Mold from Jaggedpine Forest',
        },
    },
    
    ['Brewing'] = {
        -- 0-54: Use Abysmal Sea or Crescent Reach Starter Quests (FREE)
        
        -- 54-58: Soda Water
        {
            Recipe='Soda Water',
            Trivial=58,
            Materials={'Water Flask','Soda'},
            Container='Brew Barrel',
            SkillRange={54,70},
            Notes='Simple vendor-bought, make 1500+ for Brut Champagne',
        },
        
        -- 58-122: Basic Brews
        {
            Recipe='Fetid Essence',
            Trivial=122,
            Materials={'Water Flask','Fishing Grubs'},
            Container='Brew Barrel',
            SkillRange={100,140},
            Notes='Vendor-bought components',
        },
        
        -- 122-196: Progressive to Champagne Magnum
        {
            Recipe='Champagne Magnum',
            Trivial=196,
            Materials={'Enchanted Gold Bar','Grapes','Wine Yeast','Bottle'},
            Container='Brew Barrel',
            SkillRange={170,210},
            Notes='Requires Enchanter for gold bars, make 1500+ for Brut Champagne AND Jewelcrafting',
        },
        
        -- 196-248: Minotaur Hero's Brew
        {
            Recipe='Minotaur Hero\'s Brew',
            Trivial=248,
            Materials={'Water Flask','Water Flask','Short Beer','Short Beer','Malt','Malt','Malt','Yeast','Cask'},
            Container='Brew Barrel',
            SkillRange={220,270},
            Notes='All vendor-bought',
        },
        
        -- 248-300: Brut Champagne
        {
            Recipe='Brut Champagne',
            Trivial=335,
            Materials={'Grapes','Grapes','Grapes','Soda Water','Champagne Magnum','Wine Yeast'},
            Container='Brew Barrel',
            SkillRange={248,335},
            Notes='Two sub-combines (Soda Water + Champagne Magnum), takes several hours',
        },
        
        -- Essential Sub-Combines for Tailoring
        {
            Recipe='Heady Kiola',
            Trivial=46,
            Materials={'Bottle','Packet of Kiola Sap','Packet of Kiola Sap','Water Flask'},
            Container='Brew Barrel',
            SkillRange={30,70},
            Notes='Essential for Tailoring cured silk recipes',
        },
        
        {
            Recipe='Cod Oil',
            Trivial=68,
            Materials={'Cobalt Cod','Water Flask'},
            Container='Brew Barrel',
            SkillRange={50,90},
            Notes='For studded armor, Cobalt Cod fished in Cobalt Scar',
        },
    },
    
    ['Fletching'] = {
        -- 0-54: Use Abysmal Sea or Crescent Reach Starter Quests (FREE)
        
        -- 54-202: Class 6 Wood Point Arrows
        {
            Recipe='Class 6 Wood Point Arrow',
            Trivial=202,
            Materials={'Large Groove Nocks','Bundled Wooden Arrow Shafts','Field Point Arrowheads','Set of Ceramic Arrow Vanes'},
            Container='Fletching Kit',
            SkillRange={170,220},
            Notes='All vendor-bought',
        },
        
        -- 202-335: Mithril Champion Arrows
        {
            Recipe='Mithril Champion Arrows',
            Trivial=335,
            Materials={'Mithril Arrow Heads','Mithril Bundled Arrow Shafts','Mithril Fletchings','Small Groove Nocks'},
            Container='Fletching Kit',
            SkillRange={300,350},
            Notes='Requires mithril components (smithed or vendor)',
        },
        
        -- Mithril Component Sub-Combines
        {
            Recipe='Mithril Arrow Heads',
            Trivial=200,
            Materials={'Small Brick of Mithril','Arrow Shaft Mold','File'},
            Container='Forge',
            SkillRange={180,230},
            Notes='Smithing sub-combine',
        },
    },
    
    ['Jewelry Making'] = {
        -- 0-54: Use Abysmal Sea or Crescent Reach Starter Quests (FREE)
        
        -- 54-74: Electrum Jewelry
        {
            Recipe='Electrum Malachite Bracelet',
            Trivial=74,
            Materials={'Malachite','Electrum Bar'},
            Container='Jeweler\'s Kit',
            SkillRange={54,90},
            Notes='All vendor-bought',
        },
        
        -- 74-108: Electrum Pearl
        {
            Recipe='Electrum Pearl Choker',
            Trivial=108,
            Materials={'Pearl','Electrum Bar'},
            Container='Jeweler\'s Kit',
            SkillRange={90,125},
            Notes='All vendor-bought',
        },
        
        -- 108-146: Gold Jewelry Begins
        {
            Recipe='Gold Malachite Bracelet',
            Trivial=146,
            Materials={'Malachite','Gold Bar'},
            Container='Jeweler\'s Kit',
            SkillRange={125,165},
            Notes='All vendor-bought',
        },
        
        -- 146-183: Gold Topaz
        {
            Recipe='Golden Topaz Earring',
            Trivial=183,
            Materials={'Topaz','Gold Bar'},
            Container='Jeweler\'s Kit',
            SkillRange={165,200},
            Notes='All vendor-bought',
        },
        
        -- 183-191: Gold Opal
        {
            Recipe='Golden Opal Amulet',
            Trivial=191,
            Materials={'Opal','Gold Bar'},
            Container='Jeweler\'s Kit',
            SkillRange={175,210},
            Notes='All vendor-bought',
        },
        
        -- 191-202: Fire Emerald (Requires Drops)
        {
            Recipe='Fire Emerald Golden Bracelet',
            Trivial=202,
            Materials={'Fire Emerald','Gold Bar'},
            Container='Jeweler\'s Kit',
            SkillRange={185,220},
            Notes='Fire Emerald from Elemental+ mobs',
        },
        
        -- 202-228: Platinum Jewelry Begins
        {
            Recipe='Cat Eye Platinum Necklace',
            Trivial=228,
            Materials={'Cat\'s Eye Agate','Platinum Bar'},
            Container='Jeweler\'s Kit',
            SkillRange={210,245},
            Notes='All vendor-bought',
        },
        
        -- 228-244: Platinum Amber
        {
            Recipe='Platinum Amber Ring',
            Trivial=244,
            Materials={'Amber','Platinum Bar'},
            Container='Jeweler\'s Kit',
            SkillRange={225,260},
            Notes='All vendor-bought',
        },
        
        -- 244-255: Platinum Topaz
        {
            Recipe='Platinum Topaz Necklace',
            Trivial=255,
            Materials={'Topaz','Platinum Bar'},
            Container='Jeweler\'s Kit',
            SkillRange={235,270},
            Notes='All vendor-bought',
        },
        
        -- 255-268: Platinum Fire Opal
        {
            Recipe='Platinum Fire Wedding Ring',
            Trivial=268,
            Materials={'Fire Opal','Platinum Bar'},
            Container='Jeweler\'s Kit',
            SkillRange={250,285},
            Notes='All vendor-bought',
        },
        
        -- 268-276: Platinum Sapphire
        {
            Recipe='Sapphire Platinum Necklace',
            Trivial=276,
            Materials={'Sapphire','Platinum Bar'},
            Container='Jeweler\'s Kit',
            SkillRange={258,293},
            Notes='Sapphire from Elemental+ mobs',
        },
        
        -- 276-287: Platinum Diamond
        {
            Recipe='Platinum Diamond Wedding Ring',
            Trivial=287,
            Materials={'Diamond','Platinum Bar'},
            Container='Jeweler\'s Kit',
            SkillRange={270,302},
            Notes='Diamond from Elemental+ mobs',
        },
        
        -- 287-295: Platinum Blue Diamond (Path to 300)
        {
            Recipe='Platinum Blue Diamond Tiara',
            Trivial=295,
            Materials={'Blue Diamond','Platinum Bar'},
            Container='Jeweler\'s Kit',
            SkillRange={278,310},
            Notes='Blue Diamond from Elemental+ mobs or vendor',
        },
        
        -- 295-302: Velium Blue Diamond (To 300)
        {
            Recipe='Velium Blue Diamond Bracelet',
            Trivial=302,
            Materials={'Blue Diamond','Velium Bar'},
            Container='Jeweler\'s Kit',
            SkillRange={285,320},
            Notes='Requires trip to Thurgadin for Velium Bar',
        },
        
        -- Special: Gem Studded Chain (for Smithing)
        {
            Recipe='Gem Studded Chain',
            Trivial=250,
            Materials={'Emerald','Ruby','Chain Links'},
            Container='Jeweler\'s Kit',
            SkillRange={235,270},
            Notes='Component for Embroidering Needle (smithing)',
        },
    },
    
    ['Pottery'] = {
        -- 0-54: Use Abysmal Sea or Crescent Reach Starter Quests (FREE)
        
        -- 54-122: Basic Clay Items
        {
            Recipe='Clay Idol',
            Trivial=122,
            Materials={'Small Block of Clay','Crow\'s Special Brew','Idol Sketch','Sculpting Tools'},
            Container='Pottery Wheel',
            SkillRange={54,140},
            Notes='Vendor-bought, Sculpting Tools return',
        },
        
        -- 122-202: Sealed Vials
        {
            Recipe='Sealed Vial',
            Trivial=202,
            Materials={'Small Block of Clay','Crow\'s Special Brew','Sealed Vial Sketch','Sculpting Tools'},
            Container='Pottery Wheel',
            SkillRange={180,220},
            Notes='Vendor-bought, Sculpting Tools return',
        },
        
        -- 202-335: Magic Clay Items
        {
            Recipe='Enchanted Clay Symbols',
            Trivial=335,
            Materials={'Large Block of Magic Clay','Vial of Clear Mana','Symbol Sketch','Sculpting Tools'},
            Container='Pottery Wheel',
            SkillRange={300,350},
            Notes='Requires Enchanter for summoned components',
        },
        
        -- Deity-Specific Pottery
        {
            Recipe='Idol of Cazic-Thule',
            Trivial=250,
            Materials={'Large Block of Clay','Imbued Amber','Idol Sketch','Sculpting Tools'},
            Container='Pottery Wheel',
            SkillRange={235,270},
            Notes='Cazic Thule deity summoned Imbued Amber',
        },
        
        {
            Recipe='Idol of Tunare',
            Trivial=255,
            Materials={'Large Block of Clay','Imbued Emerald','Idol Sketch','Sculpting Tools'},
            Container='Pottery Wheel',
            SkillRange={240,275},
            Notes='Tunare deity summoned Imbued Emerald',
        },
        
        -- Ceramic Linings
        {
            Recipe='Ceramic Lining',
            Trivial=180,
            Materials={'Small Block of Clay','Jar of Lacquer','Ceramic Lining Sketch','Sculpting Tools'},
            Container='Pottery Wheel',
            SkillRange={160,200},
            Notes='All vendor-bought',
        },
    },
    
    ['Tailoring'] = {
        -- 0-54: Use Abysmal Sea or Crescent Reach Starter Quests (FREE)
        -- Trophy Quest Items Listed Below for Reference
        
        -- Trophy Quest Progression (Starter Quests)
        {
            Recipe='Silk Bandage',
            Trivial=15,
            Materials={'Spider Silk','Spider Silk'},
            Container='Sewing Kit',
            SkillRange={1,30},
            Notes='Trophy quest item #1',
        },
        
        {
            Recipe='Large Patchwork Pants',
            Trivial=25,
            Materials={'Patchwork Pattern','Patchwork Materials'},
            Container='Loom',
            SkillRange={10,40},
            Notes='Trophy quest item #2',
        },
        
        {
            Recipe='Tattered Shoulderpads',
            Trivial=30,
            Materials={'Tattered Pattern','Ruined Pelt'},
            Container='Loom',
            SkillRange={15,45},
            Notes='Trophy quest item #3',
        },
        
        {
            Recipe='Small Tattered Gloves',
            Trivial=35,
            Materials={'Tattered Pattern','Ruined Pelt'},
            Container='Loom',
            SkillRange={20,50},
            Notes='Trophy quest item #4',
        },
        
        {
            Recipe='Leather Padding',
            Trivial=40,
            Materials={'Low Quality Pelt','Sewing Needle'},
            Container='Loom',
            SkillRange={25,55},
            Notes='Trophy quest item #5',
        },
        
        {
            Recipe='Raw Silk Robe',
            Trivial=48,
            Materials={'Raw Silk','Pattern'},
            Container='Loom',
            SkillRange={35,65},
            Notes='Trophy quest item #6',
        },
        
        {
            Recipe='Shade Silk Mantle',
            Trivial=50,
            Materials={'Shade Silk','Pattern'},
            Container='Loom',
            SkillRange={40,70},
            Notes='Trophy quest item #7, Shade Silk from Luclin (rarely in Bazaar)',
        },
        
        {
            Recipe='Leather Gorget',
            Trivial=52,
            Materials={'Raw-Hide Gorget','Tanning Chemicals'},
            Container='Loom',
            SkillRange={42,72},
            Notes='Trophy quest item #8, Raw-Hide Gorget from Desert of Ro',
        },
        
        {
            Recipe='Tailored Large Bag',
            Trivial=53,
            Materials={'Large Cloth','Pattern','Thread'},
            Container='Loom',
            SkillRange={43,73},
            Notes='Trophy quest item #9',
        },
        
        {
            Recipe='Studded Boots',
            Trivial=54,
            Materials={'Leather','Studs','Pattern'},
            Container='Loom',
            SkillRange={44,74},
            Notes='Trophy quest item #10, requires Smithing for Studs',
        },
        
        -- 54-82: Cured Silk
        {
            Recipe='Cured Silk Mask',
            Trivial=82,
            Materials={'Silk Swatch','Heady Kiola','Mask Pattern'},
            Container='Loom',
            SkillRange={54,100},
            Notes='Requires Brewing (Heady Kiola)',
        },
        
        -- 82-95: Greyhopper Boots
        {
            Recipe='Greyhopper Boots',
            Trivial=95,
            Materials={'Greyhopper Hide','Boots Pattern'},
            Container='Loom',
            SkillRange={82,115},
            Notes='Greyhopper Hide dropped or bazaar',
        },
        
        -- 95-115: High Quality Pelts
        {
            Recipe='Quiver',
            Trivial=115,
            Materials={'High Quality Cat Pelt','Quiver Pattern'},
            Container='Loom',
            SkillRange={95,135},
            Notes='HQ Cat Pelt from hunting',
        },
        
        -- 115-188: Acrylia Studded
        {
            Recipe='Acrylia Studded Armor',
            Trivial=188,
            Materials={'Acrylia Hide','Acrylia Studs','Pattern'},
            Container='Loom',
            SkillRange={160,210},
            Notes='Requires Smithing for studs, Brewing for tempers',
        },
        
        -- 188-222: Superb Animal Pelts - Hilt Wraps
        {
            Recipe='Hilt Wrap',
            Trivial=222,
            Materials={'Superb Animal Pelt','Hickory Handled Shears'},
            Container='Loom',
            SkillRange={188,245},
            Notes='Hickory Handled Shears crafted by smithing, pelts from hunting/bazaar',
        },
        
        -- 222-268: Immaculate Pelts - Wristband Templates
        {
            Recipe='Leather Wristband Template',
            Trivial=268,
            Materials={'Immaculate Animal Pelt','Hickory Handled Shears'},
            Container='Loom',
            SkillRange={222,290},
            Notes='Stack to 1000, very efficient skill-ups',
        },
        
        {
            Recipe='Silk Wristband Template',
            Trivial=268,
            Materials={'Immaculate Silk','Immaculate Silk','Simple Sewing Needle'},
            Container='Loom',
            SkillRange={222,290},
            Notes='Stack to 1000, 2 silk per combine (more expensive than pelts)',
        },
        
        -- 268-300: Continue Templates with Higher Materials
        {
            Recipe='Silk Wristband Template',
            Trivial=300,
            Materials={'Excellent Silk','Excellent Silk','Simple Sewing Needle'},
            Container='Loom',
            SkillRange={268,320},
            Notes='Continue to 300, any silk higher than Superb works',
        },
        
        -- Cultural Armor Templates
        {
            Recipe='Immaculate Silk Collar Template',
            Trivial=285,
            Materials={'Faysilk Filament','Silk Curing Chemicals','Silk Pattern','Simple Sewing Needle','Immaculate Silk'},
            Container='Loom',
            SkillRange={260,310},
            Notes='Cultural armor template, 1-3 silk depending on slot',
        },
        
        {
            Recipe='Immaculate Leather Collar Template',
            Trivial=285,
            Materials={'Faysilk Filament','Tanning Chemicals','Leather Pattern','Simple Sewing Needle','Immaculate Animal Pelt'},
            Container='Loom',
            SkillRange={260,310},
            Notes='Cultural armor template, 1-3 pelts depending on slot',
        },
        
        -- Studded Armor Components
        {
            Recipe='Arctic Wyvern Studded Armor',
            Trivial=220,
            Materials={'Arctic Wyvern Hide','Cod Oil','Velium Studs','Pattern'},
            Container='Loom',
            SkillRange={200,240},
            Notes='Requires Brewing (Cod Oil) and Smithing (Velium Studs)',
        },
        
        -- Sub-Combines
        {
            Recipe='Silk Swatch',
            Trivial=15,
            Materials={'Spider Silk','Spider Silk'},
            Container='Sewing Kit',
            SkillRange={1,40},
            Notes='No fail, makes 1 swatch, used in many recipes',
        },
    },
    
    ['Alchemy'] = {
        -- 0-54: Use Abysmal Sea or Crescent Reach Starter Quests (FREE)
        -- SHAMAN ONLY SKILL
        
        -- 54-150: Basic Potions
        {
            Recipe='Cloudy Potion',
            Trivial=150,
            Materials={'Duskglow Vine','Violet Tri-Tube Sap','Small Vial','Water Flask'},
            Container='Alchemy Table',
            SkillRange={54,170},
            Notes='Vendor-bought components',
        },
        
        -- 150-250: Progressive Potions
        {
            Recipe='Philter of Faerun',
            Trivial=250,
            Materials={'Tregrum','Nodding Blue Lily','Hemlock Powder','Small Vial'},
            Container='Alchemy Table',
            SkillRange={230,280},
            Notes='Nodding Blue Lily from HC zones',
        },
        
        -- 250-300: High Level Potions
        {
            Recipe='Advanced Potion of the Warrior',
            Trivial=300,
            Materials={'Expansion Herb','Expansion Component','Vial','Water Flask'},
            Container='Alchemy Table',
            SkillRange={280,325},
            Notes='Use expansion-specific herbs',
        },
    },
    
    ['Research'] = {
        -- 0-54: Use Abysmal Sea or Crescent Reach Starter Quests (FREE)
        
        -- 54-200: Spell Scrolls Progressive
        {
            Recipe='Research Spell Scroll Level 1-10',
            Trivial=150,
            Materials={'Spell Components','Ink','Quill','Parchment'},
            Container='Research Table',
            SkillRange={54,170},
            Notes='Progressive spell levels',
        },
        
        -- 200-300: Higher Level Scrolls
        {
            Recipe='Research Spell Scroll Level 50+',
            Trivial=280,
            Materials={'Rare Spell Components','Special Ink','Quill','Fine Parchment'},
            Container='Research Table',
            SkillRange={260,310},
            Notes='Requires rare components',
        },
        
        -- Cultural Research (Mechanoinstruction)
        {
            Recipe='Mechanoinstruction - Focus Type',
            Trivial=300,
            Materials={'Research Components','Special Inks','Parchment'},
            Container='Research Table',
            SkillRange={280,325},
            Notes='Used for cultural armor symbols',
        },
    },
    
    ['Tinkering'] = {
        -- 0-54: Use Abysmal Sea or Crescent Reach Starter Quests (FREE)
        -- GNOME ONLY SKILL
        
        -- 54-200: Basic Devices
        {
            Recipe='Gnomish Lockpick',
            Trivial=150,
            Materials={'Tiny Gears','Small Springs','Metal Bits'},
            Container='Forge',
            SkillRange={54,180},
            Notes='Basic gnomish device',
        },
        
        -- 200-300: Master's Servolinked (RECOMMENDED)
        {
            Recipe='Master\'s Servolinked Legs',
            Trivial=285,
            Materials={'Servolinked Components','Vendor Sprockets','Farmed Parts'},
            Container='Forge',
            SkillRange={260,320},
            Notes='Preferred over Autoactuated, uses vendor sprockets not rare Knuckle Joints',
        },
        
        {
            Recipe='Master\'s Servolinked BP',
            Trivial=290,
            Materials={'Servolinked Components','Vendor Sprockets','Farmed Parts'},
            Container='Forge',
            SkillRange={265,325},
            Notes='Preferred over Woks or Autoactuated',
        },
        
        -- 300-350: Gnome Cultural
        {
            Recipe='Gnome Cultural Clockwork Armor',
            Trivial=320,
            Materials={'Clockwork Components','Special Gears','Cultural Materials'},
            Container='Forge',
            SkillRange={300,350},
            Notes='Gnome cultural armor',
        },
    },
    
    ['Poison Making'] = {
        -- 0-54: Use Abysmal Sea or Crescent Reach Starter Quests (FREE)
        -- ROGUE ONLY SKILL
        
        -- 54-200: Basic Poisons
        {
            Recipe='Basic Weapon Coating Poison',
            Trivial=150,
            Materials={'Poison Components','Poison Vial'},
            Container='Poison Table',
            SkillRange={54,180},
            Notes='Basic poison for weapons',
        },
        
        -- 200-300: Advanced Poisons
        {
            Recipe='Advanced Weapon Coating Poison',
            Trivial=280,
            Materials={'Rare Poison Components','Poison Vial'},
            Container='Poison Table',
            SkillRange={260,310},
            Notes='Higher damage poison',
        },
    },
    
    ['Radix'] = {
        -- Custom high-end recipes for Radix automation
        {
            Recipe='Essence Fusion Chamber',
            Trivial=500,
            Materials={'Smithy Hammer','Fusion Chamber Base','Fusion Chamber Housing','Elemental Forging Temper','Elemental Forging Temper','Ancient Shield of Corrupted Tranquility'},
            Container='Forge',
            SkillRange={450,500},
            Notes='Radix custom recipe - requires multiple subcombines',
        },
        {
            Recipe='Globe of Swirling Elements',
            Trivial=0,
            Materials={'Essence of Creation','Primal Essence of Air','Primal Essence of Earth','Primal Essence of Water'},
            Container='Essence Fusion Chamber',
            SkillRange={0,500},
            Notes='Radix custom recipe - requires Essence Fusion Chamber',
        },
    },
    
    -- ================================================================
    -- SUBCOMBINES - Materials that are crafted from other materials
    -- ================================================================
    ['Subcombines'] = {
        -- ============================================================
        -- GENERAL SUBCOMBINES (Used by multiple tradeskills)
        -- ============================================================
        ['Celestial Essence'] = {
            Recipe='Celestial Essence',
            Trivial=15,
            Materials={'Concentrated Celestial Solvent','The Scent of Marr','The Scent of Marr','The Scent of Marr'},
            Container='Mixing Bowl',
            Tradeskill='Baking',
        },
        ['File'] = {
            Recipe='File',
            Trivial=21,
            Materials={'File Mold','Metal Bits','Water Flask'},
            Container='Forge',
            Tradeskill='Blacksmithing',
            Tool=true,
        },
        ['Metal Bits'] = {
            Recipe='Metal Bits',
            Trivial=18,
            Materials={'Small Piece of Ore','Small Piece of Ore','Water Flask'},
            Container='Forge',
            Tradeskill='Blacksmithing',
        },
        
        -- ============================================================
        -- SMITHING SUBCOMBINES
        -- ============================================================
        ['Velium Bits'] = {
            Recipe='Velium Bits',
            Trivial=21,
            Materials={'Small Piece of Velium','Small Piece of Velium','Coldain Velium Temper'},
            Container='Forge',
            Tradeskill='Blacksmithing',
        },
        ['Velium Studs'] = {
            Recipe='Velium Studs',
            Trivial=43,
            Materials={'Velium Bits','Velium Bits','Velium Bits','Coldain Velium Temper','File'},
            Container='Forge',
            Tradeskill='Blacksmithing',
        },
        ['Ethereal Temper'] = {
            Recipe='Ethereal Temper',
            Trivial=212,
            Materials={'Celestial Essence','Soda','Emerald Tea Leaf'},
            Container='Brew Barrel',
            Tradeskill='Brewing',
        },
        ['Non-Stick Frying Pan'] = {
            Recipe='Non-Stick Frying Pan',
            Trivial=91,
            Materials={'Frying Pan Mold','Water Flask','Metal Bits','Ceramic Lining'},
            Container='Forge',
            Tradeskill='Blacksmithing',
            Tool=true,
        },
        ['Embroidering Needle'] = {
            Recipe='Embroidering Needle',
            Trivial=122,
            Materials={'Celestial Essence','Concentrated Celestial Solvent','The Scent of Marr','The Scent of Marr','The Scent of Marr','Metal Bits','Needle Mold','Water Flask','Gem Studded Chain'},
            Container='Forge',
            Tradeskill='Blacksmithing',
            Tool=true,
        },
        ['Hickory Handled Shears'] = {
            Recipe='Hickory Handled Shears',
            Trivial=100,
            Materials={'Hickory Shaft','Small Piece of Ore','File','Water Flask'},
            Container='Forge',
            Tradeskill='Blacksmithing',
            Tool=true,
        },
        ['Dairy Spoon'] = {
            Recipe='Dairy Spoon',
            Trivial=74,
            Materials={'Water Flask','Metal Bits','Metal Bits','Scaler Mold'},
            Container='Forge',
            Tradeskill='Blacksmithing',
            Tool=true,
        },
        ['Steel Boning'] = {
            Recipe='Steel Boning',
            Trivial=37,
            Materials={'Water Flask','File','Small Brick of Ore'},
            Container='Forge',
            Tradeskill='Blacksmithing',
        },
        ['Cake Round'] = {
            Recipe='Cake Round',
            Trivial=37,
            Materials={'Water Flask','Metal Bits','Cake Round Mold','Ceramic Lining'},
            Container='Forge',
            Tradeskill='Blacksmithing',
        },
        
        -- ============================================================
        -- BREWING SUBCOMBINES
        -- ============================================================
        ['Heady Kiola'] = {
            Recipe='Heady Kiola',
            Trivial=46,
            Materials={'Bottle','Packet of Kiola Sap','Packet of Kiola Sap','Water Flask'},
            Container='Brew Barrel',
            Tradeskill='Brewing',
        },
        ['Cod Oil'] = {
            Recipe='Cod Oil',
            Trivial=68,
            Materials={'Cobalt Cod','Water Flask'},
            Container='Brew Barrel',
            Tradeskill='Brewing',
        },
        ['Soda Water'] = {
            Recipe='Soda Water',
            Trivial=58,
            Materials={'Soda','Water Flask'},
            Container='Brew Barrel',
            Tradeskill='Brewing',
        },
        ['Champagne Magnum'] = {
            Recipe='Champagne Magnum',
            Trivial=196,
            Materials={'Opal','Enchanted Gold Bar','Bottle'},
            Container='Jeweler\'s Kit',
            Tradeskill='Jewelry Making',
        },
        ['Ethereal Curing Agent'] = {
            Recipe='Ethereal Curing Agent',
            Trivial=212,
            Materials={'Celestial Essence','Celestial Essence','Soda','Packet of Paeala Sap'},
            Container='Brew Barrel',
            Tradeskill='Brewing',
        },
        ['Jumjum Spiced Beer'] = {
            Recipe='Jumjum Spiced Beer',
            Trivial=162,
            Materials={'Water Flask','Spices','Jumjum Stalk','Bottle','Barley','Hops'},
            Container='Brew Barrel',
            Tradeskill='Brewing',
        },
        
        -- ============================================================
        -- BAKING SUBCOMBINES
        -- ============================================================
        ['Marmalade Sandwich'] = {
            Recipe='Marmalade Sandwich',
            Trivial=99,
            Materials={'Apricot Marmalade','Loaf of Bread'},
            Container='Oven',
            Tradeskill='Baking',
        },
        ['Apricot Marmalade'] = {
            Recipe='Apricot Marmalade',
            Trivial=99,
            Materials={'Fruit','Frosting','Frosting','Frosting'},
            Container='Oven',
            Tradeskill='Baking',
        },
        ['Jumjum Salad'] = {
            Recipe='Jumjum Salad',
            Trivial=142,
            Materials={'Fennel','Jumjum Stalk','Vegetables','Lettuce'},
            Container='Mixing Bowl',
            Tradeskill='Baking',
        },
        ['Royal Mints'] = {
            Recipe='Royal Mints',
            Trivial=76,
            Materials={'Eucalyptus Leaf','Frosting'},
            Container='Mixing Bowl',
            Tradeskill='Baking',
        },
        ['Slice of Jumjum Cake'] = {
            Recipe='Slice of Jumjum Cake',
            Trivial=27,
            Materials={'Jumjum Cake'},
            Container='Oven',
            Tradeskill='Baking',
        },
        ['Jumjum Cake'] = {
            Recipe='Jumjum Cake',
            Trivial=166,
            Materials={'Clump of Dough','Jumjum Stalk','Cake Round','Winter Chocolate','Frosting'},
            Container='Oven',
            Tradeskill='Baking',
        },
        ['Clump of Dough'] = {
            Recipe='Clump of Dough',
            Trivial=28,
            Materials={'Basilisk Eggs','Bottle of Milk','Cup of Flour'},
            Container='Mixing Bowl',
            Tradeskill='Baking',
        },
        ['Winter Chocolate'] = {
            Recipe='Winter Chocolate',
            Trivial=95,
            Materials={'Brownie Parts','Frosting','Frosting'},
            Container='Mixing Bowl',
            Tradeskill='Baking',
        },
        ['Mature Cheese'] = {
            Recipe='Mature Cheese',
            Trivial=84,
            Materials={'Bottle of Milk','Bottle of Milk','Dairy Spoon','Rennet'},
            Container='Mixing Bowl',
            Tradeskill='Baking',
        },
        ['Vegetables'] = {
            Recipe='Vegetables',
            Trivial=15,
            Materials={'Lettuce','Carrot','Turnip'},
            Container='Mixing Bowl',
            Tradeskill='Baking',
        },
        ['Dream Meat'] = {
            Recipe='Dream Meat',
            Trivial=200,
            Materials={'Rare Dream Component','Meat Tenderizer','Spices'},
            Container='Oven',
            Tradeskill='Baking',
        },
        
        -- ============================================================
        -- JEWELCRAFTING SUBCOMBINES
        -- ============================================================
        ['Gem Studded Chain'] = {
            Recipe='Gem Studded Chain',
            Trivial=250,
            Materials={'Emerald','Ruby','Chain Links'},
            Container='Jeweler\'s Kit',
            Tradeskill='Jewelry Making',
        },
        ['Lacquered Star Ruby'] = {
            Recipe='Lacquered Star Ruby',
            Trivial=128,
            Materials={'Jar of Lacquer','Star Ruby'},
            Container='Jeweler\'s Kit',
            Tradeskill='Jewelry Making',
        },
        
        -- ============================================================
        -- POTTERY SUBCOMBINES
        -- ============================================================
        ['Ceramic Lining'] = {
            Recipe='Ceramic Lining',
            Trivial=17,
            Materials={'Quality Firing Sheet','Unfired Ceramic Lining'},
            Container='Kiln',
            Tradeskill='Pottery',
        },
        ['Unfired Ceramic Lining'] = {
            Recipe='Unfired Ceramic Lining',
            Trivial=36,
            Materials={'Water Flask','Small Block of Clay','Ceramic Lining Sketch'},
            Container='Pottery Wheel',
            Tradeskill='Pottery',
        },
        
        -- ============================================================
        -- TAILORING SUBCOMBINES
        -- ============================================================
        ['Silk Swatch'] = {
            Recipe='Silk Swatch',
            Trivial=15,
            Materials={'Spider Silk','Spider Silk'},
            Container='Sewing Kit',
            Tradeskill='Tailoring',
        },
        ['Picnic Basket'] = {
            Recipe='Picnic Basket',
            Trivial=76,
            Materials={'Woven Mandrake','Steel Boning'},
            Container='Loom',
            Tradeskill='Tailoring',
        },
        ['Woven Mandrake'] = {
            Recipe='Woven Mandrake',
            Trivial=66,
            Materials={'Mandrake Root','Mandrake Root'},
            Container='Loom',
            Tradeskill='Tailoring',
        },
        
        -- ============================================================
        -- FLETCHING SUBCOMBINES
        -- ============================================================
        ['Mithril Arrow Heads'] = {
            Recipe='Mithril Arrow Heads',
            Trivial=42,
            Materials={'Small Brick of Mithril','File','Water Flask'},
            Container='Forge',
            Tradeskill='Blacksmithing',
        },
        ['Mithril Bundled Arrow Shafts'] = {
            Recipe='Mithril Bundled Arrow Shafts',
            Trivial=42,
            Materials={'Large Brick of Mithril','Arrow Shaft Mold','File','Water Flask'},
            Container='Forge',
            Tradeskill='Blacksmithing',
        },
        ['Mithril Fletchings'] = {
            Recipe='Mithril Fletchings',
            Trivial=34,
            Materials={'Small Brick of Mithril','Mithril Working Knife'},
            Container='Fletching Kit',
            Tradeskill='Fletching',
        },
        ['Mithril Working Knife'] = {
            Recipe='Mithril Working Knife',
            Trivial=42,
            Materials={'Small Brick of Mithril','Hilt Mold','Water Flask','Dagger Blade Mold'},
            Container='Forge',
            Tradeskill='Blacksmithing',
            Tool=true,
        },
        
        -- ============================================================
        -- RADIX CUSTOM RECIPES (If applicable)
        -- ============================================================
        ['Elemental Forging Temper'] = {
            Recipe='Elemental Forging Temper',
            Trivial=400,
            Materials={'Air Mephit Blood','Earth Mephit Blood','Fire Mephit Blood','Water Mephit Blood','Celestial Essence'},
            Container='Brew Barrel',
            Tradeskill='Brewing',
        },
        ['Element Imbued Metal Sheet'] = {
            Recipe='Element Imbued Metal Sheet',
            Trivial=450,
            Materials={'Smithy Hammer','Energy Permeable Ore','Elemental Forging Temper','Bituminous Coal'},
            Container='Forge',
            Tradeskill='Blacksmithing',
        },
        ['Fusion Chamber Housing'] = {
            Recipe='Fusion Chamber Housing',
            Trivial=475,
            Materials={'Smithy Hammer','Element Imbued Metal Sheet','Element Imbued Metal Sheet','Element Imbued Metal Sheet','Element Imbued Metal Sheet','Elemental Forging Temper','Elemental Forging Temper'},
            Container='Forge',
            Tradeskill='Blacksmithing',
        },
        ['Fusion Chamber Base'] = {
            Recipe='Fusion Chamber Base',
            Trivial=475,
            Materials={'Smithy Hammer','Element Imbued Metal Sheet','Element Imbued Metal Sheet','Elemental Forging Temper'},
            Container='Forge',
            Tradeskill='Blacksmithing',
        },
    },
    
    -- ================================================================
    -- MATERIALS DATABASE
    -- ================================================================
    ['Materials'] = {
        -- ============================================================
        -- GENERAL COMPONENTS
        -- ============================================================
        
        -- Water and Containers
        ['Water Flask'] = {Location='Perago Crotal',Zone='poknowledge',Coords='+22, +242',SourceType='Vendor',Building='Eastern Trade Building'},
        ['Bottle'] = {Location='Bargol Halith',Zone='poknowledge',Coords='+70, +240',SourceType='Vendor',Building='Eastern Trade Building'},
        ['Cask'] = {Location='Brewmaster Berina',Zone='poknowledge',SourceType='Vendor'},
        ['Small Vial'] = {Location='Alchemist Redsa',Zone='poknowledge',SourceType='Vendor'},
        ['Poison Vial'] = {Location='Loran Thu\'Leth',Zone='poknowledge',Coords='-115, +1400',SourceType='Vendor',Building='Western Trade Building'},
        
        -- Tools (Return on Combine)
        ['Smithy Hammer'] = {Location='Borik Darkanvil',Zone='poknowledge',Coords='-375, +500',SourceType='Vendor',Tool=true,Building='Southeast Trader'},
        ['File'] = {Location='Crafted',SourceType='Crafted',Tool=true,ReturnsOnCombine=true,Notes='Smithing Trivial 21'},
        ['Sculpting Tools'] = {Location='Sculptor Radee',Zone='poknowledge',SourceType='Vendor',Tool=true,ReturnsOnCombine=true},
        ['Simple Sewing Needle'] = {Location='Sherin Matrick',Zone='poknowledge',SourceType='Vendor',Tool=true},
        ['Embroidering Needle'] = {Location='Crafted',SourceType='Crafted',Tool=true,Notes='Smithing Trivial 122, requires Baking+Jewelcrafting'},
        ['Hickory Handled Shears'] = {Location='Crafted',SourceType='Crafted',Tool=true,Notes='Smithing crafted'},
        ['Non-Stick Frying Pan'] = {Location='Crafted',SourceType='Crafted',Tool=true,Notes='Smithing Trivial 85, Frying Pan Mold from Jaggedpine Forest'},
        
        -- Molds and Patterns
        ['File Mold'] = {Location='Borik Darkanvil',Zone='poknowledge',Coords='-375, +500',SourceType='Vendor',Building='Southeast Trader'},
        ['Needle Mold'] = {Location='Boiron Ston',Zone='poknowledge',Coords='+30, +325',SourceType='Vendor',Building='Eastern Trade Building'},
        ['Bracer Mold'] = {Location='Smith Kaphiri',Zone='crescentreach',SourceType='Vendor'},
        ['Arrow Shaft Mold'] = {Location='Fletcher Lenvale',Zone='poknowledge',SourceType='Vendor'},
        ['Frying Pan Mold'] = {Location='Roghur Muleson',Zone='freeporteast',SourceType='Vendor',Notes='Jaggedpine Forest'},
        ['Cake Round Mold'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Scaler Mold'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Hilt Mold'] = {Location='Borik Darkanvil',Zone='poknowledge',Coords='-375, +500',SourceType='Vendor'},
        ['Dagger Blade Mold'] = {Location='Borik Darkanvil',Zone='poknowledge',Coords='-375, +500',SourceType='Vendor'},
        
        -- Patterns (Tailoring)
        ['Mask Pattern'] = {Location='Higwyn Matrick',Zone='poknowledge',Coords='+120, +1480',SourceType='Vendor',Building='Western Trader'},
        ['Boots Pattern'] = {Location='Higwyn Matrick',Zone='poknowledge',Coords='+120, +1480',SourceType='Vendor',Building='Western Trader'},
        ['Quiver Pattern'] = {Location='Higwyn Matrick',Zone='poknowledge',Coords='+120, +1480',SourceType='Vendor',Building='Western Trader'},
        ['Silk Pattern'] = {Location='Sherin Matrick',Zone='poknowledge',SourceType='Vendor'},
        ['Leather Pattern'] = {Location='Sherin Matrick',Zone='poknowledge',SourceType='Vendor'},
        ['Silk Wristband Template Pattern'] = {Location='Sherin Matrick',Zone='poknowledge',SourceType='Vendor'},
        ['Chainmail Collar Template Pattern'] = {Location='Borik Darkanvil',Zone='poknowledge',Coords='-375, +500',SourceType='Vendor'},
        
        -- Solvents and Chemicals
        ['Concentrated Celestial Solvent'] = {Location='Darius Gandril',Zone='poknowledge',Coords='+55, +1520',SourceType='Vendor',Building='Western Trader'},
        ['The Scent of Marr'] = {Location='Loran Thu\'Leth',Zone='poknowledge',Coords='-114, +1415',SourceType='Vendor',Building='Western Trader'},
        ['Metal Tempering Chemicals'] = {Location='Zosran Hammertail',Zone='poknowledge',SourceType='Vendor'},
        ['Silk Curing Chemicals'] = {Location='Sherin Matrick',Zone='poknowledge',SourceType='Vendor'},
        ['Tanning Chemicals'] = {Location='Sherin Matrick',Zone='poknowledge',SourceType='Vendor'},
        
        -- ============================================================
        -- SMITHING MATERIALS
        -- ============================================================
        
        -- Basic Smithing
        ['Small Piece of Ore'] = {Location='Borik Darkanvil',Zone='poknowledge',Coords='-375, +500',SourceType='Vendor',Building='Southeast Trader'},
        ['Small Brick of Ore'] = {Location='Borik Darkanvil',Zone='poknowledge',Coords='-375, +500',SourceType='Vendor'},
        ['Sheet of Metal'] = {Location='Smith Yahya',Zone='crescentreach',SourceType='Vendor'},
        ['Small Bricks of Ore'] = {Location='Smith Yahya',Zone='crescentreach',SourceType='Vendor'},
        ['Metal Bits'] = {Location='Crafted',SourceType='Crafted',Notes='Smithing Trivial 18'},
        
        -- Velium Components
        ['Small Piece of Velium'] = {Location='Velketor\'s Labyrinth',SourceType='Dropped',Notes='Golems/Spiders/Gargoyles, can also be chiseled'},
        ['Coldain Velium Temper'] = {Location='Nimren Stonecutter',Zone='thurgadina',Coords='+50, -110',SourceType='Vendor'},
        ['Velium Bar'] = {Location='Talem Tucter',Zone='thurgadina',SourceType='Vendor'},
        ['Velium Bits'] = {Location='Crafted',SourceType='Crafted',Notes='Smithing Trivial 21'},
        ['Velium Studs'] = {Location='Crafted',SourceType='Crafted',Notes='Smithing Trivial 43, essential for tailoring'},
        
        -- Special Smithing Materials
        ['Brick of Ethereal Energy'] = {Location='Planes of Power',SourceType='Dropped'},
        ['Ethereal Temper'] = {Location='Planes of Power',SourceType='Dropped'},
        
        -- Coal and Ore Types
        ['Bituminous Coal'] = {Location='Borik Darkanvil',Zone='poknowledge',SourceType='Vendor'},
        ['Black Nitrous Coal'] = {Location='Zosran Hammertail',Zone='poknowledge',SourceType='Vendor'},
        ['Lustrous Black Coal'] = {Location='Borik Darkanvil',Zone='poknowledge',Coords='-375, +500',SourceType='Vendor'},
        ['Brimstone Coal'] = {Location='Various Vendors',SourceType='Vendor'},
        ['Rhenium Ore'] = {Location='Hate\'s Fury Low-Mid',SourceType='Dropped',Notes='HC content'},
        ['Tungsten Ore'] = {Location='Hate\'s Fury Mid-High',SourceType='Dropped',Notes='HC content'},
        ['Vanadium Ore'] = {Location='Various',SourceType='Dropped',Notes='Cultural armor'},
        
        -- Pottery Components
        ['Quality Firing Sheet'] = {Location='Sculptor Radee',Zone='poknowledge',SourceType='Vendor'},
        
        -- ============================================================
        -- JEWELCRAFTING MATERIALS
        -- ============================================================
        
        -- Gems (Vendor-Bought)
        ['Malachite'] = {Location='Audri Deepfacet',Zone='poknowledge',Coords='+400, +760',SourceType='Vendor',Building='Northern Trader'},
        ['Pearl'] = {Location='Audri Deepfacet',Zone='poknowledge',Coords='+400, +760',SourceType='Vendor',Building='Northern Trader'},
        ['Topaz'] = {Location='Audri Deepfacet',Zone='poknowledge',Coords='+400, +760',SourceType='Vendor',Building='Northern Trader'},
        ['Opal'] = {Location='Audri Deepfacet',Zone='poknowledge',Coords='+400, +760',SourceType='Vendor',Building='Northern Trader'},
        ['Cat\'s Eye Agate'] = {Location='Audri Deepfacet',Zone='poknowledge',Coords='+400, +760',SourceType='Vendor',Building='Northern Trader'},
        ['Amber'] = {Location='Audri Deepfacet',Zone='poknowledge',Coords='+400, +760',SourceType='Vendor',Building='Northern Trader'},
        ['Fire Opal'] = {Location='Audri Deepfacet',Zone='poknowledge',Coords='+400, +760',SourceType='Vendor',Building='Northern Trader'},
        ['Emerald'] = {Location='Audri Deepfacet',Zone='poknowledge',Coords='+400, +760',SourceType='Vendor',Building='Northern Trader'},
        ['Ruby'] = {Location='Audri Deepfacet',Zone='poknowledge',Coords='+400, +760',SourceType='Vendor',Building='Northern Trader'},
        
        -- Gems (Dropped)
        ['Fire Emerald'] = {Location='Elemental Planes+',SourceType='Dropped'},
        ['Star Ruby'] = {Location='Elemental Planes+',SourceType='Dropped'},
        ['Sapphire'] = {Location='Elemental Planes+',SourceType='Dropped'},
        ['Diamond'] = {Location='Elemental Planes+',SourceType='Dropped'},
        ['Blue Diamond'] = {Location='Elemental Planes+',SourceType='Dropped',Notes='Also available from vendor'},
        
        -- Metal Bars
        ['Electrum Bar'] = {Location='Audri Deepfacet',Zone='poknowledge',Coords='+400, +760',SourceType='Vendor',Building='Northern Trader'},
        ['Gold Bar'] = {Location='Audri Deepfacet',Zone='poknowledge',Coords='+400, +760',SourceType='Vendor',Building='Northern Trader'},
        ['Platinum Bar'] = {Location='Audri Deepfacet',Zone='poknowledge',Coords='+400, +760',SourceType='Vendor',Building='Northern Trader'},
        
        -- Enchanted Bars (Summoned)
        ['Enchanted Electrum Bar'] = {Location='Enchanter',SourceType='Summoned',Notes='Enchant Metal spell'},
        ['Enchanted Gold Bar'] = {Location='Enchanter',SourceType='Summoned',Notes='Enchant Gold spell, needed for Champagne Magnum'},
        ['Enchanted Platinum Bar'] = {Location='Enchanter',SourceType='Summoned',Notes='Enchant Metal spell'},
        ['Enchanted Velium Bar'] = {Location='Enchanter',SourceType='Summoned',Notes='Enchant Metal spell'},
        
        -- Jewelcrafting Components
        ['Chain Links'] = {Location='Crafted or Vendor',SourceType='Vendor'},
        ['Gem Studded Chain'] = {Location='Crafted',SourceType='Crafted',Notes='Jewelcrafting Trivial 250, for Embroidering Needle'},
        
        -- ============================================================
        -- TAILORING MATERIALS
        -- ============================================================
        
        -- Basic Tailoring
        ['Spider Silk'] = {Location='East Karana Spiders',SourceType='Dropped',Notes='Common drop'},
        ['Silk Swatch'] = {Location='Crafted',SourceType='Crafted',Notes='Tailoring Trivial 15, no fail'},
        
        -- Pelts (Progressive Quality)
        ['Ruined Pelt'] = {Location='Various Zones',SourceType='Dropped'},
        ['Low Quality Pelt'] = {Location='Various Zones',SourceType='Dropped'},
        ['Medium Quality Pelt'] = {Location='Various Zones',SourceType='Dropped'},
        ['High Quality Cat Pelt'] = {Location='Various Zones',SourceType='Dropped'},
        ['Superb Animal Pelt'] = {Location='Various Zones/Bazaar',SourceType='Dropped',Notes='Skill 188-222'},
        ['Immaculate Animal Pelt'] = {Location='Various Zones/Bazaar',SourceType='Dropped',Notes='Skill 222-268'},
        ['Excellent Animal Pelt'] = {Location='Various Zones/Bazaar',SourceType='Dropped',Notes='Skill 268+'},
        
        -- Silk (Progressive Quality)
        ['Raw Silk'] = {Location='Various',SourceType='Dropped'},
        ['Shade Silk'] = {Location='Luclin',SourceType='Dropped',Notes='Rare in bazaar'},
        ['Fine Silk'] = {Location='Hate\'s Fury Low-Mid',SourceType='Dropped',Notes='HC content'},
        ['Immaculate Silk'] = {Location='Various/Bazaar',SourceType='Dropped',Notes='Skill 222-268'},
        ['Excellent Silk'] = {Location='Hate\'s Fury Mid-High',SourceType='Dropped',Notes='HC content, skill 268+'},
        
        -- Special Tailoring Materials
        ['Greyhopper Hide'] = {Location='Various',SourceType='Dropped'},
        ['Acrylia Hide'] = {Location='Various',SourceType='Dropped'},
        ['Arctic Wyvern Hide'] = {Location='Cobalt Scar Wyverns',SourceType='Dropped'},
        ['Strand of Ether'] = {Location='Planes',SourceType='Dropped'},
        
        -- Tailoring Filaments
        ['Soft Filament'] = {Location='Sherin Matrick',Zone='poknowledge',SourceType='Vendor'},
        ['Fine Filament'] = {Location='Sherin Matrick',Zone='poknowledge',SourceType='Vendor'},
        ['Faysilk Filament'] = {Location='Various Vendors',SourceType='Vendor',Notes='For cultural armor'},
        
        -- Tailoring Special Items
        ['Raw-Hide Gorget'] = {Location='Desert of Ro',SourceType='Dropped',Notes='Trophy quest, expensive in bazaar'},
        
        -- ============================================================
        -- BAKING MATERIALS
        -- ============================================================
        
        -- Basic Baking Ingredients
        ['Fresh Fish'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Bat Wing'] = {Location='Darius Gandril',Zone='poknowledge',SourceType='Vendor'},
        ['Cheese'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Mature Cheese'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Loaf of Bread'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Bun'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Bear Meat'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Bottle of Milk'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Cup of Flour'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Frosting'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Rennet'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        
        -- Vegetables and Herbs
        ['Lettuce'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Tomato'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Carrot'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Turnip'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Fennel'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Jumjum Stalk'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Eucalyptus Leaf'] = {Location='Alchemist Redsa',Zone='poknowledge',SourceType='Vendor'},
        ['Mandrake Root'] = {Location='Alchemist Redsa',Zone='poknowledge',SourceType='Vendor'},
        
        -- Special Baking Items
        ['Fruit'] = {Location='Anywhere',SourceType='Foraged'},
        ['Basilisk Eggs'] = {Location='A Shady Merchant',SourceType='Vendor'},
        ['Brownie Parts'] = {Location='Lesser Faydark',SourceType='Dropped'},
        ['Oil Dressing'] = {Location='Klen Ironstove',Zone='poknowledge',SourceType='Vendor'},
        ['Rare Dream Component'] = {Location='Various',SourceType='Dropped',Notes='For Dream Meat recipe'},
        ['Meat Tenderizer'] = {Location='Various Vendors',SourceType='Vendor'},
        
        -- Baking Sub-Combines
        ['Dream Meat'] = {Location='Crafted',SourceType='Crafted',Notes='Sub-combine for Dreamburger'},
        
        -- Picnic Components
        ['Marmalade Sandwich'] = {Location='Crafted',SourceType='Crafted'},
        ['Jumjum Salad'] = {Location='Crafted',SourceType='Crafted'},
        ['Royal Mints'] = {Location='Crafted',SourceType='Crafted'},
        ['Slice of Jumjum Cake'] = {Location='Crafted',SourceType='Crafted'},
        ['Picnic Basket'] = {Location='Crafted',SourceType='Crafted'},
        
        -- Expansion Ingredients
        ['Relic Fragment'] = {Location='The Darkened Sea',SourceType='Dropped',Notes='TDS expansion ingredient'},
        
        -- ============================================================
        -- BREWING MATERIALS
        -- ============================================================
        
        -- Basic Brewing
        ['Fishing Grubs'] = {Location='Caden Zharik',Zone='poknowledge',SourceType='Vendor',Notes='Near parcel merchant by small bank'},
        ['Short Beer'] = {Location='Brewmaster Berina',Zone='poknowledge',SourceType='Vendor'},
        ['Malt'] = {Location='Brewmaster Berina',Zone='poknowledge',SourceType='Vendor'},
        ['Yeast'] = {Location='Brewmaster Berina',Zone='poknowledge',SourceType='Vendor'},
        ['Wine Yeast'] = {Location='Brewmaster Berina',Zone='poknowledge',SourceType='Vendor'},
        ['Barley'] = {Location='Brewmaster Berina',Zone='poknowledge',SourceType='Vendor'},
        ['Hops'] = {Location='Brewmaster Berina',Zone='poknowledge',SourceType='Vendor'},
        ['Spices'] = {Location='Brewmaster Berina',Zone='poknowledge',SourceType='Vendor'},
        
        -- Special Brewing
        ['Grapes'] = {Location='Brewmaster Berina',Zone='poknowledge',SourceType='Vendor'},
        ['Soda'] = {Location='Caden Zharik',Zone='poknowledge',SourceType='Vendor'},
        ['Emerald Tea Leaf'] = {Location='Brewmaster Berina',Zone='poknowledge',SourceType='Vendor'},
        ['Packet of Kiola Sap'] = {Location='Swin Blackeye',Zone='westfreeport',Coords='+115, -650',SourceType='Vendor'},
        ['Packet of Paeala Sap'] = {Location='Brewmaster Berina',Zone='poknowledge',SourceType='Vendor'},
        
        -- Fishing Components
        ['Cobalt Cod'] = {Location='Cobalt Scar',SourceType='Fishing'},
        
        -- Brewing Sub-Combines
        ['Soda Water'] = {Location='Crafted',SourceType='Crafted',Notes='Brewing Trivial 58, make 1500+'},
        ['Champagne Magnum'] = {Location='Crafted',SourceType='Crafted',Notes='Brewing Trivial 196, make 1500+, also for Jewelcrafting'},
        ['Heady Kiola'] = {Location='Crafted',SourceType='Crafted',Notes='Brewing Trivial 46, essential for Tailoring'},
        ['Cod Oil'] = {Location='Crafted',SourceType='Crafted',Notes='Brewing Trivial 68, for studded armor'},
        ['Jumjum Spiced Beer'] = {Location='Crafted',SourceType='Crafted',Notes='Sub-combine for picnics'},
        
        -- ============================================================
        -- FLETCHING MATERIALS
        -- ============================================================
        
        -- Basic Fletching
        ['Large Groove Nocks'] = {Location='Fletcher Lenvale',Zone='poknowledge',SourceType='Vendor'},
        ['Small Groove Nocks'] = {Location='Fletcher Lenvale',Zone='poknowledge',SourceType='Vendor'},
        ['Bundled Wooden Arrow Shafts'] = {Location='Fletcher Lenvale',Zone='poknowledge',SourceType='Vendor'},
        ['Field Point Arrowheads'] = {Location='Fletcher Lenvale',Zone='poknowledge',SourceType='Vendor'},
        ['Set of Ceramic Arrow Vanes'] = {Location='Fletcher Lenvale',Zone='poknowledge',SourceType='Vendor'},
        
        -- Mithril Fletching Components
        ['Small Brick of Mithril'] = {Location='Merchant Niwiny',Zone='gfaydark',SourceType='Vendor'},
        ['Large Brick of Mithril'] = {Location='Merchant Niwiny',Zone='gfaydark',SourceType='Vendor'},
        ['Mithril Arrow Heads'] = {Location='Crafted',SourceType='Crafted',Notes='Smithing sub-combine'},
        ['Mithril Bundled Arrow Shafts'] = {Location='Crafted',SourceType='Crafted',Notes='Smithing sub-combine'},
        ['Mithril Fletchings'] = {Location='Crafted',SourceType='Crafted',Notes='Smithing sub-combine'},
        
        -- Wood Components
        ['Hickory Shaft'] = {Location='Fletching Vendors',SourceType='Vendor',Notes='For Hickory Handled Shears'},
        
        -- ============================================================
        -- POTTERY MATERIALS
        -- ============================================================
        
        -- Clay
        ['Small Block of Clay'] = {Location='Sculptor Radee',Zone='poknowledge',SourceType='Vendor'},
        ['Large Block of Clay'] = {Location='Sculptor Radee',Zone='poknowledge',SourceType='Vendor'},
        ['Large Block of Magic Clay'] = {Location='Enchanter',SourceType='Summoned',Notes='Thicken Mana spell'},
        
        -- Pottery Components
        ['Crow\'s Special Brew'] = {Location='Sculptor Radee',Zone='poknowledge',SourceType='Vendor'},
        ['Sealed Vial Sketch'] = {Location='Sculptor Radee',Zone='poknowledge',SourceType='Vendor'},
        ['Idol Sketch'] = {Location='Sculptor Radee',Zone='poknowledge',SourceType='Vendor'},
        ['Ceramic Lining Sketch'] = {Location='Sculptor Radee',Zone='poknowledge',SourceType='Vendor'},
        ['Jar of Lacquer'] = {Location='Audri Deepfacet',Zone='poknowledge',SourceType='Vendor'},
        
        -- Deity Summoned Items
        ['Imbued Amber'] = {Location='Cazic Thule Deity',SourceType='Summoned'},
        ['Imbued Emerald'] = {Location='Tunare Deity',SourceType='Summoned'},
        ['Vial of Clear Mana'] = {Location='Enchanter',SourceType='Summoned',Notes='Thicken Mana spell'},
        
        -- ============================================================
        -- ALCHEMY MATERIALS (SHAMAN ONLY)
        -- ============================================================
        
        ['Duskglow Vine'] = {Location='Alchemist Redsa',Zone='poknowledge',SourceType='Vendor'},
        ['Violet Tri-Tube Sap'] = {Location='Alchemist Redsa',Zone='poknowledge',SourceType='Vendor'},
        ['Tregrum'] = {Location='Alchemist Redsa',Zone='poknowledge',SourceType='Vendor'},
        ['Hemlock Powder'] = {Location='Alchemist Redsa',Zone='poknowledge',SourceType='Vendor'},
        ['Nodding Blue Lily'] = {Location='Hate\'s Fury zones',SourceType='Dropped',Notes='HC content'},
        
        -- ============================================================
        -- PLANES OF POWER MATERIALS
        -- ============================================================
        
        ['Air Mephit Blood'] = {Location='Plane of Air',SourceType='Dropped'},
        ['Earth Mephit Blood'] = {Location='Plane of Earth',SourceType='Dropped'},
        ['Fire Mephit Blood'] = {Location='Plane of Fire',SourceType='Dropped'},
        ['Water Mephit Blood'] = {Location='Plane of Water',SourceType='Dropped'},
        ['Energy Permeable Ore'] = {Location='Ssraeshza Temple',SourceType='Ground Spawn'},
        ['Ancient Shield of Corrupted Tranquility'] = {Location='Quarm/Time',SourceType='Dropped',Notes='Very rare'},
        ['Essence of Creation'] = {Location='Drosal',SourceType='Quest',Notes='Max tradeskills required'},
        ['Primal Essence of Air'] = {Location='Quest',SourceType='Quest'},
        ['Primal Essence of Earth'] = {Location='Drosal',SourceType='Quest'},
        ['Primal Essence of Water'] = {Location='Drosal',SourceType='Quest'},
        
        -- ============================================================
        -- BRELL'S BOUNTY (Multi-use)
        -- ============================================================
        
        ['Brell\'s Bounty'] = {Location='Anywhere',SourceType='Foraged/Ground Spawn/Dropped',Notes='Excellent for Baking and Brewing skill-ups'},
        
        -- ============================================================
        -- PORTABLE CONTAINERS
        -- ============================================================
        
        ['Fletching Kit'] = {Location='Fletcher Lenvale',Zone='poknowledge',SourceType='Vendor',Container=true},
        ['Jeweler\'s Kit'] = {Location='Audri Deepfacet',Zone='poknowledge',SourceType='Vendor',Container=true},
        ['Medicine Bag'] = {Location='Alchemist Redsa',Zone='poknowledge',SourceType='Vendor',Container=true},
        ['Sewing Kit'] = {Location='Various Tailoring Vendors',SourceType='Vendor',Container=true},
        ['Collapsible Distillery'] = {Location='Various Brewing Vendors',SourceType='Vendor',Container=true},
        ['Pottery Wheel'] = {Location='Various Pottery Vendors',SourceType='Vendor',Container=true,Notes='Portable version'},
        ['Toolkit'] = {Location='Gnome Vendors',SourceType='Vendor',Container=true,Notes='Tinkering'},
        ['Mortar & Pestle'] = {Location='Rogue Vendors',SourceType='Vendor',Container=true,Notes='Poison Making'},
        ['Lexicon'] = {Location='Library Vendors',SourceType='Vendor',Container=true,Notes='Research'},
    },
    
    -- ================================================================
    -- TRADESKILL STATIONS BY ZONE
    -- ================================================================
    ['Stations'] = {
        ['poknowledge'] = {
            Name='Plane of Knowledge',
            ['Pottery Wheel'] = {Loc='-288.50 780.29 -91.34',Building='Northern Trade Building'},
            ['Kiln'] = {Loc='-346.99 796.83 -91.34',Building='Northern Trade Building'},
            ['Oven'] = {Loc='-346.22 775.99 -91.34',Building='Northern Trade Building'},
            ['Forge'] = {Loc='343.74 760.84 -91.34',Building='Eastern Trade Building'},
            ['Loom'] = {Loc='-337.39 924.73 -91.78',Building='Northern Trade Building'},
            ['Brew Barrel'] = {Loc='-315.00 969.43 -91.89',Building='Northern Trade Building'},
            ['Research Table'] = {Loc='Library Area',Notes='Near entrance'},
            ['Alchemy Table'] = {Loc='Various',Notes='Multiple locations'},
            ['Fletching Table'] = {Loc='Eastern Trade Building',Notes='Multiple locations'},
            ['Poison Table'] = {Loc='Rogue Guild Area',Notes='Limited access'},
        },
        ['freeporttemple'] = {
            Name='Freeport Temple',
            ['Pottery Wheel'] = {Loc='646 -68 -52'},
            ['Kiln'] = {Loc='585 -62 -52'},
            ['Oven'] = {Loc='584 66 -52'},
            ['Forge'] = {Loc='802 55 -52'},
            ['Loom'] = {Loc='650 64 -52'},
            ['Brew Barrel'] = {Loc='800 -53 -52'},
        },
        ['guildhall'] = {
            Name='Guild Hall',
            ['Pottery Wheel'] = {Loc='-16.73 99.56 4.30'},
            ['Kiln'] = {Loc='16.68 101.11 4.30'},
            ['Oven'] = {Loc='-56.40 80.69 4.30'},
            ['Forge'] = {Loc='-348.07 763.15 -91.93'},
            ['Loom'] = {Loc='58.21 92.37 4.30'},
            ['Brew Barrel'] = {Loc='33.07 113.01 4.30'},
        },
        ['gfaydark'] = {
            Name='Greater Faydark',
            ['Feir\'Dal Forge'] = {Loc='-245 61 118',Notes='Kelethin area'},
        },
        ['crescentreach'] = {
            Name='Crescent Reach',
            ['All Stations'] = {Loc='Near Upstairs Bank',Notes='Starter area with all basic stations'},
        },
        ['abyssalsea'] = {
            Name='Abysmal Sea',
            ['All Stations'] = {Loc='Various',Notes='Starter quest hub for FREE skill-ups to 54'},
        },
    },
    
    -- ================================================================
    -- VENDOR DIRECTORY
    -- ================================================================
    ['Vendors'] = {
        -- Plane of Knowledge Vendors
        ['Audri Deepfacet'] = {
            Zone='poknowledge',
            Coords='+400, +760',
            Building='Northern Trader Building',
            Specializes='Gems, Metal Bars, Jar of Lacquer',
            Sells={'Malachite','Pearl','Topaz','Opal','Cat\'s Eye Agate','Amber','Fire Opal','Emerald','Ruby','Blue Diamond','Electrum Bar','Gold Bar','Platinum Bar','Jar of Lacquer'},
        },
        ['Borik Darkanvil'] = {
            Zone='poknowledge',
            Coords='-375, +500',
            Building='Southeast Trader Building',
            Specializes='Smithing Supplies',
            Sells={'Small Piece of Ore','Small Brick of Ore','Water Flask','File Mold','Hilt Mold','Dagger Blade Mold','Lustrous Black Coal','Chainmail Collar Template Pattern'},
        },
        ['Higwyn Matrick'] = {
            Zone='poknowledge',
            Coords='+120, +1480',
            Building='Western Trader Building',
            Specializes='Tailoring Patterns',
            Sells={'Mask Pattern','Boots Pattern','Quiver Pattern','Various Tailoring Patterns'},
        },
        ['Sherin Matrick'] = {
            Zone='poknowledge',
            Building='Various',
            Specializes='Tailoring Supplies',
            Sells={'Simple Sewing Needle','Silk Pattern','Leather Pattern','Silk Wristband Template Pattern','Soft Filament','Fine Filament','Silk Curing Chemicals','Tanning Chemicals'},
        },
        ['Boiron Ston'] = {
            Zone='poknowledge',
            Coords='+30, +325',
            Building='Eastern Trade Building',
            Specializes='Smithing Molds',
            Sells={'Needle Mold','Various Patterns'},
        },
        ['Bargol Halith'] = {
            Zone='poknowledge',
            Coords='+70, +240',
            Building='Eastern Trade Building',
            Specializes='Brewing Containers',
            Sells={'Bottle','Cask'},
        },
        ['Perago Crotal'] = {
            Zone='poknowledge',
            Coords='+22, +242',
            Building='Eastern Trade Building',
            Specializes='Water Flasks',
            Sells={'Water Flask'},
        },
        ['Caden Zharik'] = {
            Zone='poknowledge',
            Location='Near parcel vendor by small bank',
            Specializes='Brewing Components',
            Sells={'Fishing Grubs','Soda'},
        },
        ['Brewmaster Berina'] = {
            Zone='poknowledge',
            Specializes='Brewing Supplies',
            Sells={'Short Beer','Malt','Yeast','Wine Yeast','Barley','Hops','Spices','Grapes','Emerald Tea Leaf','Packet of Paeala Sap','Bottle'},
        },
        ['Klen Ironstove'] = {
            Zone='poknowledge',
            Specializes='Baking Supplies',
            Sells={'Fresh Fish','Cheese','Mature Cheese','Loaf of Bread','Bun','Bear Meat','Water Flask','Bottle of Milk','Cup of Flour','Frosting','Rennet','Lettuce','Tomato','Carrot','Turnip','Fennel','Jumjum Stalk','Cake Round Mold','Scaler Mold','Oil Dressing'},
        },
        ['Darius Gandril'] = {
            Zone='poknowledge',
            Coords='+55, +1520',
            Building='Western Trader Building',
            Specializes='Special Solvents',
            Sells={'Concentrated Celestial Solvent','Bat Wing'},
        },
        ['Loran Thu\'Leth'] = {
            Zone='poknowledge',
            Coords='-114, +1415',
            Building='Western Trader Building',
            Specializes='Scents and Poisons',
            Sells={'The Scent of Marr','Poison Vial'},
        },
        ['Alchemist Redsa'] = {
            Zone='poknowledge',
            Specializes='Alchemy Supplies',
            Sells={'Eucalyptus Leaf','Mandrake Root','Duskglow Vine','Violet Tri-Tube Sap','Tregrum','Small Vial','Hemlock Powder','Medicine Bag'},
        },
        ['Sculptor Radee'] = {
            Zone='poknowledge',
            Specializes='Pottery Supplies',
            Sells={'Sculpting Tools','Crow\'s Special Brew','Sealed Vial Sketch','Small Block of Clay','Large Block of Clay','Idol Sketch','Ceramic Lining Sketch','Small Piece of Ore','Quality Firing Sheet'},
        },
        ['Fletcher Lenvale'] = {
            Zone='poknowledge',
            Specializes='Fletching Supplies',
            Sells={'Large Groove Nocks','Small Groove Nocks','Bundled Wooden Arrow Shafts','Field Point Arrowheads','Set of Ceramic Arrow Vanes','Arrow Shaft Mold','Fletching Kit'},
        },
        ['Zosran Hammertail'] = {
            Zone='poknowledge',
            Specializes='Advanced Smithing',
            Sells={'Black Nitrous Coal','Metal Tempering Chemicals'},
        },
        ['A Shady Merchant'] = {
            Zone='poknowledge',
            Specializes='Special Items',
            Sells={'Basilisk Eggs'},
        },
        
        -- Thurgadin Vendors
        ['Nimren Stonecutter'] = {
            Zone='thurgadina',
            Coords='+50, -110',
            Specializes='Velium Supplies',
            Sells={'Coldain Velium Temper'},
        },
        ['Talem Tucter'] = {
            Zone='thurgadina',
            Specializes='Velium Bars',
            Sells={'Velium Bar'},
        },
        
        -- Crescent Reach Vendors
        ['Smith Yahya'] = {
            Zone='crescentreach',
            Specializes='Basic Smithing',
            Sells={'Sheet of Metal','Small Bricks of Ore'},
        },
        ['Smith Kaphiri'] = {
            Zone='crescentreach',
            Specializes='Smithing Molds',
            Sells={'Bracer Mold'},
        },
        ['Smith Gyasi'] = {
            Zone='crescentreach',
            Specializes='Water Flasks',
            Sells={'Water Flask'},
        },
        ['Merchant Osaze'] = {
            Zone='crescentreach',
            Location='Ground Floor',
            Specializes='Baking Ingredients',
        },
        ['Merchant Odimari'] = {
            Zone='crescentreach',
            Location='Ground Floor',
            Specializes='Fresh Fish',
        },
        ['Merchant Wyn\'las'] = {
            Zone='crescentreach',
            Location='Ground Floor',
            Specializes='Bat Wings',
        },
        ['Butcher Umi'] = {
            Zone='crescentreach',
            Specializes='Spit',
        },
        
        -- Other Zone Vendors
        ['Swin Blackeye'] = {
            Zone='westfreeport',
            Coords='+115, -650',
            Specializes='Kiola Sap',
            Sells={'Packet of Kiola Sap'},
        },
        ['Roghur Muleson'] = {
            Zone='freeporteast',
            Specializes='Frying Pan Mold',
            Sells={'Frying Pan Mold'},
            Notes='Jaggedpine Forest vendor',
        },
        ['Merchant Niwiny'] = {
            Zone='gfaydark',
            Specializes='Mithril Bricks',
            Sells={'Small Brick of Mithril','Large Brick of Mithril'},
        },
        
        -- Special NPCs
        ['Jolum'] = {
            Zone='bazaar',
            Coords='153, -425',
            Specializes='Trophy Bag Token Exchange',
            Notes='Turn in temporary bags for permanent bag tokens',
        },
        ['Drosal'] = {
            Zone='poknowledge',
            Specializes='Max Tradeskill Quests',
            Notes='Requires max tradeskills for quests',
        },
        ['Culturalist Devari'] = {
            Zone='poknowledge',
            Location='Library Area',
            Specializes='Cultural Armor Compendiums',
            Notes='Post-2014 simplified cultural recipes',
        },
        ['Instructor Tenn'] = {
            Zone='poknowledge',
            Location='Library Area',
            Specializes='Cultural Information',
        },
    },
    
    -- ================================================================
    -- SKILL-UP PATH RECOMMENDATIONS
    -- ================================================================
    ['SkillPaths'] = {
        ['Baking'] = {
            {Range='0-54',Method='Abysmal Sea or Crescent Reach Quests',Cost='FREE'},
            {Range='54-191',Method='Patty Melt',Cost='Very Cheap',Notes='Requires Non-Stick Frying Pan (smithing)'},
            {Range='191-300',Method='Dreamburger Paradise OR Expansion Ingredients',Cost='Moderate',Notes='Dreamburger has sub-combines, expansion path does not'},
            {Range='300-350',Method='Learn Many Recipes',Cost='Variable',Notes='Make one of everything from various expansions'},
        },
        ['Blacksmithing'] = {
            {Range='0-54',Method='Abysmal Sea or Crescent Reach Quests',Cost='FREE'},
            {Range='54-100',Method='Banded Bracers',Cost='Cheap'},
            {Range='100-300',Method='Progressive Metal Types (Bronze->Iron->Steel->Platinum->Velium)',Cost='Expensive',Notes='Use small items like bracers for efficiency'},
            {Range='300-350',Method='Cultural Templates and Expansion Recipes',Cost='Very Expensive'},
        },
        ['Brewing'] = {
            {Range='0-54',Method='Abysmal Sea or Crescent Reach Quests',Cost='FREE'},
            {Range='54-58',Method='Soda Water (Make 1500+)',Cost='Very Cheap'},
            {Range='58-196',Method='Progressive to Champagne Magnum (Make 1500+)',Cost='Cheap',Notes='Also used for Jewelcrafting'},
            {Range='196-300',Method='Brut Champagne',Cost='Moderate',Notes='Two sub-combines, takes several hours'},
            {Range='300-350',Method='Expansion Drinks and Potions',Cost='Moderate'},
        },
        ['Fletching'] = {
            {Range='0-54',Method='Abysmal Sea or Crescent Reach Quests',Cost='FREE'},
            {Range='54-202',Method='Class 6 Wood Point Arrows',Cost='Cheap'},
            {Range='202-335',Method='Mithril Champion Arrows',Cost='Moderate',Notes='Requires smithing sub-combines'},
            {Range='300-350',Method='Various Arrow Types',Cost='Moderate'},
        },
        ['Jewelry Making'] = {
            {Range='0-54',Method='Abysmal Sea or Crescent Reach Quests',Cost='FREE'},
            {Range='54-196',Method='Electrum->Gold Progressive',Cost='Very Cheap',Notes='All vendor-bought'},
            {Range='196-279',Method='Platinum Ruby Veils (Do Champagne Magnum FIRST if doing Brewing)',Cost='Cheap'},
            {Range='279-295',Method='Platinum Blue Diamond Tiaras',Cost='Cheap'},
            {Range='295-302',Method='Velium Blue Diamond Bracelets',Cost='Cheap',Notes='Trip to Thurgadin'},
            {Range='300-350',Method='Various Jewelry Recipes',Cost='Moderate'},
            Notes='EASIEST and CHEAPEST tradeskill to master!',
        },
        ['Pottery'] = {
            {Range='0-54',Method='Abysmal Sea or Crescent Reach Quests',Cost='FREE'},
            {Range='54-122',Method='Clay Idols',Cost='Cheap'},
            {Range='122-202',Method='Sealed Vials',Cost='Cheap'},
            {Range='202-300',Method='Magic Clay Items or Deity Idols',Cost='Moderate',Notes='Requires Enchanter or Deity'},
            {Range='300-350',Method='Various Pottery Recipes',Cost='Moderate'},
        },
        ['Tailoring'] = {
            {Range='0-54',Method='Abysmal Sea or Crescent Reach Quests',Cost='FREE'},
            {Range='54-82',Method='Cured Silk Mask',Cost='Cheap',Notes='Requires Brewing (Heady Kiola)'},
            {Range='82-188',Method='Greyhopper->HQ Pelts->Acrylia',Cost='Moderate'},
            {Range='188-222',Method='Hilt Wraps (Superb Pelts)',Cost='Moderate',Notes='Requires smithing (Hickory Handled Shears)'},
            {Range='222-268',Method='Wristband Templates (Immaculate Pelts)',Cost='Moderate',Notes='Stack to 1000, very efficient'},
            {Range='268-300',Method='Continue Templates (Excellent+ Materials)',Cost='Expensive',Notes='Pelts cheaper than silk'},
            {Range='300-350',Method='Many Recipes from Expansions',Cost='Expensive',Notes='~2000+ recipes total'},
        },
        ['Alchemy'] = {
            {Range='0-54',Method='Abysmal Sea or Crescent Reach Quests',Cost='FREE'},
            {Range='54-300',Method='Progressive Potions',Cost='Expensive',Notes='SHAMAN ONLY, many foraged components'},
            {Range='300-350',Method='Expansion Potions',Cost='Expensive'},
        },
        ['Research'] = {
            {Range='0-54',Method='Abysmal Sea or Crescent Reach Quests',Cost='FREE'},
            {Range='54-300',Method='Progressive Spell Scrolls',Cost='Moderate'},
            {Range='300-350',Method='High Level Scrolls and Cultural',Cost='Moderate'},
        },
        ['Tinkering'] = {
            {Range='0-54',Method='Abysmal Sea or Crescent Reach Quests',Cost='FREE'},
            {Range='54-300',Method='Master\'s Servolinked (NOT Autoactuated)',Cost='Expensive',Notes='GNOME ONLY, use vendor sprockets'},
            {Range='300-350',Method='Gnome Cultural and Devices',Cost='Very Expensive'},
        },
        ['Poison Making'] = {
            {Range='0-54',Method='Abysmal Sea or Crescent Reach Quests',Cost='FREE'},
            {Range='54-300',Method='Progressive Poisons',Cost='Moderate',Notes='ROGUE ONLY'},
            {Range='300-350',Method='Advanced Poisons',Cost='Moderate'},
        },
    },
    
    -- ================================================================
    -- TRADESKILL INTERDEPENDENCIES
    -- ================================================================
    ['Dependencies'] = {
        ['Tailoring Requires'] = {
            {Skill='Smithing',Component='Velium Studs',Use='Studded Armor',Notes='Essential for many recipes'},
            {Skill='Smithing',Component='Hickory Handled Shears',Use='Hilt Wraps and Templates',Notes='188-300 skill-ups'},
            {Skill='Brewing',Component='Heady Kiola',Use='Cured Silk',Notes='54-82 skill-ups'},
            {Skill='Brewing',Component='Cod Oil',Use='Studded Armor',Notes='Arctic Wyvern armor'},
            {Skill='Baking',Component='Celestial Essence',Use='Embroidering Needle',Notes='Via Smithing'},
            {Skill='Jewelcrafting',Component='Gem Studded Chain',Use='Embroidering Needle',Notes='Via Smithing'},
        },
        ['Smithing Requires'] = {
            {Skill='Baking',Component='Celestial Essence',Use='Embroidering Needle',Notes='Advanced tailoring tool'},
            {Skill='Jewelcrafting',Component='Gem Studded Chain',Use='Embroidering Needle',Notes='Advanced tailoring tool'},
        },
        ['Brewing Requires'] = {
            {Skill='Jewelcrafting',Component='Champagne Magnum',Use='Brut Champagne',Notes='196-300 skill-ups'},
        },
        ['Fletching Requires'] = {
            {Skill='Smithing',Component='Mithril Arrow Components',Use='Mithril Arrows',Notes='202-335 skill-ups'},
        },
        ['Cultural Requires'] = {
            {Skill='Research',Component='Mechanoinstruction',Use='Cultural Symbols',Notes='Focus effects'},
            {Skill='Smithing',Component='Chain Templates',Use='Chain Armor',Notes='Cultural base'},
            {Skill='Tailoring',Component='Silk/Leather Templates',Use='Silk/Leather Armor',Notes='Cultural base'},
            {Skill='Tinkering',Component='Clockwork Templates',Use='Gnome Armor',Notes='Gnome cultural'},
        },
        Notes='Level SMITHING and BREWING first as they provide components for many other skills',
    },
    
    -- ================================================================
    -- IMPORTANT NOTES AND TIPS
    -- ================================================================
    ['ImportantNotes'] = {
        ['General'] = {
            'ALWAYS do Abysmal Sea or Crescent Reach starter quests for FREE skill-ups to 54',
            'ALWAYS equip your tradeskill trophy for 15% skill bonus',
            'Prime stats: INT or WIS for most skills (DEX for Fletching/Poison, STR for Smithing)',
            'Wait until level 90+ if possible for maximum stats',
            'Use stationary containers in PoK for more inventory space',
            'Tradeskill Depot is essential for storing massive amounts of materials',
            'Get stat buffs (INT, WIS, DEX, STR) before tradeskilling',
            'Keep food/drink in top inventory slot to avoid eating materials',
        },
        ['Skill Caps'] = {
            'Base cap without AA: 200',
            'With New Tanaan Mastery AA (3 AA per skill): Can have 6 skills at 300+',
            'Maximum skill: 350',
            'Trophy bonus: Up to 15%',
            'Skill-up rate: ~10% failure at appropriate trivial',
        },
        ['Trophy System'] = {
            'Get trophy at skill 50',
            'Trophy evolves through 5 stages',
            'Trophy must be wielded during evolution',
            'Can summon temporary 100% weight reduction bags',
            'Turn temp bag to Jolum in Bazaar (153, -425) for permanent bag token',
            'Fully evolved trophy can be placed in house for free tribute use',
        },
        ['300 to 350 Push'] = {
            'Must LEARN many recipes, not just skill up',
            'Make at least ONE of everything while leveling',
            'Use /outputfile recipes [SKILLNAME] to track known recipes',
            'Recipe names in-game may differ from EQ Traders (NOCK vs GROOVE)',
            'Missing components error = need to scribe a book/scroll',
            'Focus on expansion-specific recipes',
            'Total recipes needed varies: Tailoring ~2000+, others less',
        },
        ['Cost Rankings'] = {
            'Cheapest: Jewelcrafting, Brewing, Baking',
            'Moderate: Fletching, Pottery, Research, Poison Making',
            'Expensive: Tailoring, Alchemy',
            'Very Expensive: Tinkering, Smithing',
        },
        ['Fastest to Master'] = {
            'Jewelcrafting: EASIEST and CHEAPEST (mostly vendor-bought)',
            'Brewing: Can reach 248 in days, very cheap',
            'Baking: Relatively fast and inexpensive',
        },
        ['Recommended Order'] = {
            '1. Do Jewelcrafting first (easiest, provides components)',
            '2. Do Smithing second (provides tools and components for many skills)',
            '3. Do Brewing third (provides components for Tailoring and itself)',
            '4. Do Baking fourth (provides Celestial Essence for Smithing)',
            '5. Do Tailoring (requires Smithing, Brewing, Baking components)',
            '6. Do remaining skills as desired',
        },
        ['Class Restrictions'] = {
            'Alchemy: SHAMAN ONLY',
            'Poison Making: ROGUE ONLY',
            'Tinkering: GNOME ONLY',
        },
    },
}
