import Papa from 'papaparse';

const userCsv = `"View","Order #","Item Id","Item","Quantity","Price","Date","Tracking #","Tax","Shipping","Handling"
"View Order","62005844","260853614","Set of Decorative Horned and Steampunk Masks","1","$49.99","04/20/2026","Refunded","0","0.01","0"
"View Order","63142297","265354872","Vintage 1979 Hand-Tooled Hand-Painted Leather Wall Hanging Heraldic Shield","1","$11.00","06/09/2026","872915767340","0","10.74","8"
"View Order","63142297","265378438","Ariat Women's Black Leather Lace-Up Paddock Boots Size 6 US EU 36","1","$9.49","06/09/2026","872915767340","0","10.74","8"
"View Order","63188936","266429316","Dr. Martens 1460 Smooth Leather Black Lace-Up Boots US Women's 8","1","$14.99","06/11/2026","381965937635","0","12.13","7.96"
"View Order","63188936","266475252","Lot Of 3 The Monsters Plush Dolls","1","$19.99","06/11/2026","381965937635","0","12.13","7.96"
"View Order","63188936","266527643","Kerr Leathers Black Leather Motorcycle Chaps Pants Size XL USA","1","$7.99","06/11/2026","381965937635","0","12.13","7.96"
"View Order","63188936","266304174","TRIPP NYC Women's Bleach Splatter Eye Print Cropped Straight Leg Jeans Size XL","1","$14.99","06/11/2026","381965937635","0","12.13","7.96"
"View Order","63216371","266509844","Women's Showpo Black Dress Size 2-NWT","1","$5.15","06/12/2026","382030277041","0","10.88","5"
"View Order","63216371","266333981","Tripp NYC Daang Goodman Corset Bustier Top - Womens Size 4","1","$21.00","06/12/2026","382030277041","0","10.88","5"
"View Order","63235426","266224327","Death Saves x Dungeons & Dragons Vecna Long Sleeve T-Shirt Large","1","$12.00","06/13/2026","9200190272034201024644","0","5","1.99"
"View Order","63235442","266478893","Men's XL Black Genuine Leather Motorcycle Vest Event Leather","1","$13.00","06/13/2026","9234690272034200416930","0","5","1.99"
"View Order","63273477","266616107","Tramp Women's Medium Long Sleeve Cotton Blouse Cream White Pinstripe","1","$8.99","06/15/2026","525528274413","0","10.73","10"
"View Order","63273477","266603931","White House Black Market LS Belle Tweed Moto Jacket Women Size 10 New","1","$20.00","06/15/2026","525528274413","0","10.73","10"
"View Order","63273477","266608937","NWT ASTR the Label Orchid Purple Floral Lace Sleeveless Dress Women's Size Large","1","$13.00","06/15/2026","525528274413","0","10.73","10"
"View Order","63273477","266608885","Dr. Martens Blaire Black Leather Platform Gladiator Sandals Women's 7-8","1","$27.00","06/15/2026","525528274413","0","10.73","10"
"View Order","63273477","266444047","Mens Dark Rock Gothic Black Pants with Skull Design and Chains - Size L","1","$39.00","06/15/2026","525528274413","0","10.73","10"
"View Order","63273539","266846562","Dr Martens 2422  Smooth Leather Lace Up Doc Boots Cherry Red Women’s  Size 7","1","$21.00","06/15/2026","873206685750","0","11.9","12"
"View Order","63273539","266844518","Starbucks Souvenir Coffee Mugs (11)Different Geographic Locations.","1","$53.99","06/15/2026","873206685750","0","11.9","12"
"View Order","63293587","266985923","All Saints Black Heel Boots Womens Size: 40 (EU)","1","$24.66","06/16/2026","873272547427","0","11.9","12"
"View Order","63293587","266848212","11 Starbucks Been There & You Are Here Series Mugs 14oz Collection Lot","1","$41.00","06/16/2026","873272547427","0","11.9","12"
"View Order","63297695","267003259","Star Trek Collectible Lot PEZ Dispensers AMT/ERTL Model Kits Mouse Mat","1","$51.00","06/16/2026","873577619978","0","11.14","2"
"View Order","63324912","266832992","Collectible Vintage Bombay Bowler Pith Helmet: Khaki Color","1","$11.00","06/17/2026","873403081917","0","9.43","8"
"View Order","63324912","266698652","Killstar Women's Medium Black Gothic Cathedral Embroidered Dress Velvet","1","$16.00","06/17/2026","873403081917","0","9.43","8"
"View Order","63349540","266896056","Vince Camuto Womens Vamp Black Leather Stiletto Heel Ankle Bootie Size 9.5M","1","$5.00","06/18/2026","382206027292","0","13.65","5"
"View Order","63377109","267754170","Vintage Italian Genuine Animal Powder Horn with Wooden Cap & Leather Strap","1","$13.99","06/19/2026","873501743374","0","11.6","3.5"
"View Order","63377130","267097390","BCBGMAXAZRIA Black Button-Up Blazer Size 6","1","$14.99","06/19/2026","873409045825","0","19.42","0"
"View Order","63377130","266713343","Lot of Four Dungeon in a Box Dungeons and Dragons Adventure Sets","1","$49.00","06/19/2026","873409045825","0","19.42","0"
"View Order","63385844","267176800","BattleTech MechWarrior Roleplaying Game Manuals/Books Lot 1980's 90's","1","$92.00","06/19/2026","873472908908","0","10.59","3"
"View Order","63385956","267224255","NWT Liverpool Los Angeles Women's Black Princess Dart Boyfriend Blazer Size L","1","$9.99","06/19/2026","873383850204","0","10.08","3"
"View Order","63386030","267230530","Meadow Rue By Anthropology Women's Black Crochet Fit & Flare Dress Size 6","1","$10.99","06/19/2026","873384840254","0","9.16","3"
"View Order","63386104","267188773","Harley Davidson Black Suede Leather Jacket Tassels Motorcycle M","1","$31.00","06/19/2026","382183146080","0","0.02","6"
"View Order","63386104","266847699","Tripp NYC Goth Skate Grunge Straps Super Baggy Y2K Pants Green Black Size 2X","1","$76.00","06/19/2026","382183146080","0","0.02","6"
"View Order","63399958","267624771","Women's Tim Burton Nightmare Before Christmas Gothic Jacket Medium Black Velvet","1","$29.95","06/20/2026","873370938180","0","5.99","0"
"View Order","63416831","267884391","Wicca Natural Magic Kit by Lisa Chamberlain 2018 Chamberlain Publications","1","$9.99","06/21/2026","873372606709","0","10.7","0.99"
"View Order","63430361","267411039","Star Wars | Edge of the Empire | Age of Rebellion | Roleplaying Rules | Lot of 3","1","$43.00","06/22/2026","873578705363","0","11.17","2"
"View Order","63430380","267252718","NWT Lucci Lu Women's Black Beaded Short Sleeve Cropped Blouse Top Size 10","1","$9.99","06/22/2026","873527720980","0","9.16","3"
"View Order","63502386","267685472","WizKids MechWarrior Miniature Game Pieces Set","1","$24.95","06/24/2026","531622783000","0","0.02","0"
"View Order","63502386","267451470","Bundle of Witchcraft Books, Tarot & Oracle Cards","1","$49.99","06/24/2026","531622783000","0","0.02","0"
"View Order","63502414","267705522","Vintage TTRPG Books Lot: Dungeons & Dragons, Shadowrun and more with extras","1","$82.00","06/24/2026","5268 1716 1006","0","27.16","3"
"View Order","63502450","267948316","Hot Topic Women's My Neighbor Totoro Knitted Acrylic Green Size M Sweater","1","$19.99","06/24/2026","524623695119","0","5.99","0"
"View Order","63502461","267589546","Dorian Cleavenger Signed Fantasy Warrior Woman Art Print 19x15 Framed 1998","1","$24.99","06/24/2026","382284327435","0","0.01","0"
"View Order","63502523","267700316","3.6lbs RPG Quickstart Booklets & Character Sheets Grab Bag","1","$42.00","06/24/2026","873715322333","0","11.11","1"
"View Order","63536800","268059105","Hot Leathers Black Leather Motorcycle Chaps Size Large Fringed Trim","1","$9.99","06/26/2026","873842268410","0","14.85","4"
"View Order","63536800","267691818","Free People Women's Tops & Sweaters Lot M Sheer Dress Hoodie Thermal Cardigan","1","$51.00","06/26/2026","873842268410","0","14.85","4"
"View Order","63536824","267818315","Heavy Metal Adult Graphic Novels","1","$21.00","06/26/2026","382378135711","0","24.56","12"
"View Order","63536824","267818640","Heavy Metal Adult Graphic Novels","1","$17.89","06/26/2026","382378135711","0","24.56","12"
"View Order","63536824","267819140","Heavy Metal Adult Graphic Novels","1","$17.89","06/26/2026","382378135711","0","24.56","12"
"View Order","63536824","267818495","Heavy Metal Adult Graphic Novels","1","$26.00","06/26/2026","382378135711","0","24.56","12"
"View Order","63536824","267819185","Heavy Metal Adult Graphic Novels","1","$26.00","06/26/2026","382378135711","0","24.56","12"
"View Order","63536824","267818320","Heavy Metal Adult Graphic Novels","1","$17.89","06/26/2026","382378135711","0","24.56","12"
"View Order","63541357","268562837","Forplay Women's XS/S Gothic Witch Costume Dress Black Velvet Spiderweb Lace-Up","1","$19.95","06/26/2026","873822191582","0","5.99","0"
"View Order","63556707","267994254","Ultra Pink Black Sheer Floral Mesh Top Women's Size M Fairy Cottage Whimsigoth","1","$7.99","06/27/2026","382403019739","0","9.73","0"
"View Order","63556937","267495073","Scala Black Sheer Beaded Floral Mesh Long Sleeve Top Size M","1","$19.95","06/27/2026","873707968241","0","5.99","0"
"View Order","63557038","266585298","Derimod Expo Edwina Women's Black Leather Jacket Small Detachable Fur Collar","1","$29.95","06/27/2026","873701190758","0","5.99","0"
"View Order","63562416","268216543","Free People Women's Black Lace Puffed Sleeve Square Neck Blouse Top Size L","1","$19.99","06/27/2026","9400136106616274585594","0","10","3.5"
"View Order","63599359","268022554","D&D Dungeons & Dragons 5th Ed Monster Manual Player's Handbook Volo's Guide Lot","1","$25.12","06/29/2026","382458035547","0","12.14","7.5"
"View Order","63599359","267949412","Milton Bradley HeroQuest Game System Vintage 1989 Board Game","1","$38.00","06/29/2026","382458035547","0","12.14","7.5"
"View Order","63599422","268264132","Tripp NYC Women's Gothic Brocade Jacket XXL Lace-Up Corset Skull Buttons","1","$41.00","06/29/2026","873977180816","0","14.85","4"
"View Order","63599422","268297569","6pc We The Free Women's Clothing Lot Size S Tops Sweaters Free People","1","$41.00","06/29/2026","873977180816","0","14.85","4"
"View Order","63599512","268101296","Harley-Davidson Hustin Black Leather Harness Motorcycle Boots Men's Size 9","1","$28.00","06/29/2026","382345667020","0","17.81","5.98"
"View Order","63599512","267780403","HeroQuest Game System Milton Bradley MB 1989 Vintage Fantasy RPG Board Game","1","$56.66","06/29/2026","382345667020","0","17.81","5.98"
"View Order","63605434","268193052","Empyre Gray Wash Denim Skater Style Jeans/Pants Men's Size 30","1","$6.02","06/29/2026","873785638359","0","10.31","4"
"View Order","63605434","267948619","Collection of Seven Steampunk Themed Costume Items w/ Witchdoctor Masks","1","$51.50","06/29/2026","873785638359","0","10.31","4"
"View Order","63702058","268134276","Tripp NYC Black Fishnet Garter Hoodie Jacket Medium New with Tags","1","$51.00","07/03/2026","874109368020","0","5","1.99"
"View Order","63732690","268305087","Dungeons & Dragons: The Shackled City Adventure Path Book","1","$166.00","07/05/2026","531622829564","0","0.01","0"
"View Order","63749441","268253738","Marvel Civil War Heroic Roleplaying Essentials Event Book","1","$9.99","07/06/2026","874224987047","0","11.81","2"
"View Order","63749490","268681058","Y2K Gothic Social Collision Hoodie S & Hot Topic Jeans 1 Star Patch Set","1","$21.00","07/06/2026","874164906559","0","14.85","2"
"View Order","63753805","268125201","Assorted ShadowRun RPG Campaign Books, Beginner Box & Rulebooks","1","$81.00","07/06/2026","874121907173","0","20.12","2.25"
"View Order","63793843","269605127","John Carter Of Mars Edgar Rice Burroughs Hardcover Book","1","$13.99","07/07/2026","382537824190","0","12.61","5.5"
"View Order","63793843","269388254","Star Trek Bundle","1","$13.99","07/07/2026","382537824190","0","12.61","5.5"
"View Order","63849164","269350173","Free People Black Floral Embroidered Jacket Womens Size 0","1","$9.99","07/10/2026","382588061583","0","11.51","12"
"View Order","63849164","269350903","Sanctuary x Anthropologie Green Cotton/Poly Sweater Jacket Womens Size XL","1","$11.00","07/10/2026","382588061583","0","11.51","12"
"View Order","63849164","269344822","The Classic Woman By Evan Picone Blue Wool Coat Womens","1","$19.00","07/10/2026","382588061583","0","11.51","12"
"View Order","63849164","269208191","The World of Tolkien 7-Book Box Set by David Day","1","$76.00","07/10/2026","382588061583","0","11.51","12"
"View Order","63875423","269583264","Lot of 3 D&D RPG Books Player's Handbook v3.5 Deep Magic 5E Monster Manual II","1","$46.00","07/11/2026","874570788398","0","10.88","2"
"View Order","63883195","269153440","Fantasy RPG Rulebook Lot: OSRIC, Lion Rampant & More","1","$82.00","07/11/2026","524952787596","0","25.52","4.5"
"View Order","63883220","269346403","The World of Tolkien 7-Book Box Set by David Day","1","$26.00","07/11/2026","874301988652","0","12.53","2"
"View Order","63924602","269692865","Templar Dagger Medieval Knight Decorative Short Sword With Scabbard 15 Inch","1","$76.50","07/13/2026","382608088184","0","10.88","2"
"View Order","63924621","269695562","Dungeons & Dragons Stranger Things Welcome to the Hellfire Club Game Sealed New","1","$33.50","07/13/2026","382609751550","0","12.53","2"
"View Order","63933924","269927715","Lamentations Of The Flame Princess Player Core Book Hardcover Rules & Magic","1","$16.49","07/14/2026","382630944034","0","10.88","2"
"View Order","63982833","269207308","Lululemon Women's Teal/Gray Active Wear Shorts","1","$7.99","07/16/2026","9400136106616274612740","0","12.08","2.99"
"View Order","64007675","270106222","Soundelux Audio Publishing 1994 Lord Of Rings 9-CD Audiobook In wood crate","1","$9.99","07/17/2026","382719981872","0","19.83","5.98"
"View Order","64007675","269763090","3 Pcs DK Publishing Star Wars Reference & Guide Hardcover Book Collection","1","$9.99","07/17/2026","382719981872","0","19.83","5.98"
"View Order","64039449","270793980","VNT Wilsons Leather Pelle Studio Genuine Leather Cabbie/Newsboy Cap Sz L/XL","1","$10.00","07/18/2026","874747548720","0","12.24","2"
"View Order","64039449","270708432","6pc Dungeons & Dragons Books And Booklets Grab Bag","1","$31.25","07/18/2026","874747548720","0","12.24","2"
"View Order","64089996","270391916","SOCOFY Boots W/BOHO-CHIC, Multicolor Patchwork Design-Size EU 40 (US 9.5)","1","$23.88","07/21/2026","874919250691","0","15.03","7.98"
"View Order","64089996","270362744","Games Workshop Warhammer 40k Table Top Books Lot Of 4","1","$16.22","07/21/2026","874919250691","0","15.03","7.98"
"View Order","64105118","270808975","Men's Black Faux Leather Western Outback Cowboy Hat Bucking Horse Logo Sz M","1","$16.99","07/21/2026","874954133459","0","10.74","6"
"View Order","64105118","270676047","Purple Worm War Of The Dragon Queen Set Dungeons & Dragons Huge Uncommon 21 / 60","1","$28.05","07/21/2026","874954133459","0","10.74","6"
"View Order","64168088","270846170","Harmony Gold ""Robotech: The Macross Saga"" RPG Hardcover Book","1","$43.01","07/24/2026","382838705895","0","0.01","0"
"View Order","64221566","270958860","Rifts World Book 5 Triax NGR & World Book 31 Triax 2 RPG Sourcebooks Set","1","$13.00","07/27/2026","874943696508","0","9.98","1.99"
"View Order","64221603","271142317","47 Brand NY Yankees Navy Blue Adjustable Baseball Cap OSFA Cotton Hat","1","$9.99","07/27/2026","9200190415638400003740","0","5","1.99"
"View Order","64221651","270984192","Lot of 11 Vintage FASA Star Trek RPG Modules Sourcebooks 1980s 1990s Used","1","$45.99","07/27/2026","875158886624","0","13.93","0"
"View Order","64221651","271054595","Vintage Star Trek RPG Books Lot FASA Corp Sourcebooks Manuals 9.64 lbs Used","1","$91.00","07/27/2026","875158886624","0","13.93","0"
"View Order","64221651","270984188","Vintage Star Trek RPG Books FASA Seeker Gaming Modules Manuals Lot Used","1","$71.01","07/27/2026","875158886624","0","13.93","0"
"View Order","64242293","270817447","Dune House Atreides #1-4 Complete Set BOOM! Studios Brian Herbert Comics","1","$14.95","07/27/2026","875180867940","0","10.44","0"
"View Order","64242293","271054596","Vintage 1980s FASA Star Trek RPG Manuals Supplements Tactical Combat Lot","1","$40.00","07/27/2026","875180867940","0","10.44","0"
"View Order","64315161","271648401","BlankNYC Women's Green Black Long Sleeve Pockets Full-Zip Bomber Jacket Size M","1","$9.99","07/30/2026","9434636106616274950172-9434636106616274950189","0","10.08","6"
"View Order","64315161","271359322","Lot of 3 Dungeons & Dragons Books","1","$36.00","07/30/2026","9434636106616274950172-9434636106616274950189","0","10.08","6"
"View Order","64315254","271827136","Vintage Giorgio Armani Classico 100% Wool Ladies' Suit Jacket, See Measurements","1","$12.99","07/30/2026","875325981960","0","16.64","6"
"View Order","64315254","271488085","Dungeons & Dragons 4th Edition 4 Book Lot Dungeon Master's Guide Draconomicon","1","$41.10","07/30/2026","875325981960","0","16.64","6"
"View Order","64317945","271490256","DigiTech RP360 XP Multi-Effects Guitar Processor Pedal with Looper","1","$60.00","07/30/2026","875306306687","0","10.44","0"
"View Order","64340249","271687337","Ray-Ban Unisex Wayfarer RB 4340 Black Sunglasses 50[]22 Made in Italy With Case","1","$24.99","07/31/2026","383009039539","0","10.74","0"
"View Order","64340249","271733155","Y2K Desigual T Shirt Dress Size S Black Red Mixed Print Floral Witchy Charmed","1","$17.00","07/31/2026","383009039539","0","10.74","0"
"View Order","64340249","271612419","Nasty Gal Black Gothic Smock Dress Size 0 Balloon Sleeves Ruffled Vamp Witchy","1","$14.99","07/31/2026","383009039539","0","10.74","0"
"View Order","64340365","271713390","Frank Herbert Dune  Paperback Set of 3","1","$19.99","07/31/2026","875253084892","0","13.61","9"
"View Order","64340365","271298005","Boris Vallejo Fantasy Art Hardcover Book Set of 2","1","$19.99","07/31/2026","875253084892","0","13.61","9"
"View Order","64349438","271702821","Anthropologie Metallic Red Lined Pleated Maxi Skirt WM Size XS NWT","1","$9.99","08/01/2026","875335832630","0","8.95","6"
"View Order","64349438","271764426","Star Trek Official Starships Collection Tellarite Cruiser #115 Die-Cast Replica","1","$11.00","08/01/2026","875335832630","0","8.95","6"
"View Order","64349650","271946213","EUC Unbranded Black Puff Shoulder Military-Style Goth Trench Coat Women M","1","$18.88","08/01/2026","875257165976","0","0.01","3.99"
"View Order","64349686","271617637","Dune by Frank Herbert Deluxe Hardcover Book Gilded Edges Arrakis Map 2005","1","$38.00","08/01/2026","9434636106616274960898","0","11.34","3.35"
"View Order","64362755","271807328","Vintage Black Crushed Velvet Women's Long Coat Double Breasted ILGWU","1","$88.50","08/01/2026","875380812207","0","10.93","10"
"View Order","64362755","271818260","Minecraft The Complete Handbook Collection 4 Hardcover Books Mojang Set","1","$8.50","08/01/2026","875380812207","0","10.93","10"
"View Order","64362755","271818561","Black Rabbit Fur Trapper Hat Ushanka Winter Cold Weather Ear Flaps Chin Strap","1","$9.99","08/01/2026","875380812207","0","10.93","10"
"View Order","64362755","271807522","Vintage Whiting Los Angeles Navy Varsity Letterman Sweater Size 42","1","$43.00","08/01/2026","875380812207","0","10.93","10"
"View Order","64362755","271741836","Men's BX Long Sleeve Button-Up Shirt Large Gothic Biker Skull Embroidered","1","$9.50","08/01/2026","875380812207","0","10.93","10"
"View Order","64398556","271912997","Women's Size 10 Eliza J. New York Elegant Purple Dress (FS17E)","1","$8.99","08/03/2026","875323474057","0","12.13","4.5"
"View Order","64398556","271685156","Dune 3 Book Set, Dune, Dune Messiah & Children of Dune","1","$8.99","08/03/2026","875323474057","0","12.13","4.5"
"View Order","64398668","272006777","Hasbro Darth Vader's TIE Advanced Fighter Toy No Figures","1","$8.99","08/03/2026","382992406390","0","11.69","6"
"View Order","64398668","271894145","Sealed 1992 TSR Advanced Dungeons & Dragons Dark Sun Road to Urik 2406 DSQ1","1","$52.00","08/03/2026","382992406390","0","11.69","6"
"View Order","64413165","271966836","Dungeons and Dragons Shadow of the Dragon Queen Deluxe Edition","1","$46.88","08/04/2026","875436150801","0","0.01","0"
"View Order","64462601","272394073","Diane Von Furstenberg Womens M Red Mohair Wool Blend Sweater","1","$6.99","08/06/2026","9200190109343600023284","0","12.25","3"
"View Order","64462640","272394042","Free People Womens Black Embroidered Sleeveless Dress Size L","1","$12.99","08/06/2026","875560062394","0","19.42","6"
"View Order","64462640","272069456","Ace Frank Herbert Dune Series Box Set 6-Book Paperback Set","1","$46.00","08/06/2026","875560062394","0","19.42","6"
"View Order","64463093","271952479","Collection of 4 Audiobook Box Sets: Dune, The Aeneid, Metamorphoses, Iliad & Ody","1","$66.99","08/06/2026","538577348667","0","0.01","0"
"View Order","64475232","272400189","Women's Ivory/Pink/Blue SS Vintage Cardigan sweater - Size L NWT","1","$7.99","08/06/2026","383148412603","0","16.36","5.98"
"View Order","64475232","272075472","Set of 5 Dungeons & Dragons 4th Edition Roleplaying Game Supplements by WotC","1","$41.00","08/06/2026","383148412603","0","16.36","5.98"
"View Order","64488579","272329296","Gary Gordon Outerwear Julius & Sons Boston Men's Leather Jacket Size 44","1","$9.99","08/07/2026","875865939894","0","191.59","4"
"View Order","64488579","272331427","Schott NYC Perfecto Black Leather Motorcycle Jacket Size 50 USA Made","1","$301.00","08/07/2026","875865939894","0","191.59","4"
"View Order","64488638","272344634","Defiant-302 Black Industrial Gothic Boots Size 11 Man-Made Materials","1","$46.00","08/07/2026","875490335090","0","10.16","12"
"View Order","64488638","272426572","Rebecca Minkoff Womens Wool Cropped Peacoat RM-967 Large Navy Eclipse","1","$24.48","08/07/2026","875490335090","0","10.16","12"
"View Order","64488638","272227421","3 Sets Polyhedral Dice Dungeons and Dragons Chessex Festive Sunburst Metal.","1","$21.00","08/07/2026","875490335090","0","10.16","12"
"View Order","64550368","272589407","NWT Womens Ashley Steward Black Lace Top (Size 3X)","1","$19.99","08/10/2026","383111955750","0","13.18","9"
"View Order","64550368","272579667","Dungeons & Dragons 3.5 Edition Players Handbook","1","$128.00","08/10/2026","383111955750","0","13.18","9"
"View Order","64550368","272586980","Lot of PREACHER Comic Books","1","$9.99","08/10/2026","383111955750","0","13.18","9"
"View Order","64626703","272843840","Dungeons & Dragons Campaign Setting and Monster Manual III Books","1","$56.00","08/13/2026","538577386510","0","0.01","0"
"View Order","64627373","273537667","Pelle Studio Wilsons Men’s M Black Leather Hooded Quilted Thinsulate Jacket","1","$19.99","08/13/2026","875892367067","0","14.09","4"
"View Order","64627373","272871462","Punk Rave WG-887BQF Black Gothic Punk Skirt F/L Cotton Polyurethane NWT","1","$50.44","08/13/2026","875892367067","0","14.09","4"
"View Order","64686213","273505927","Betsey Johnson Women's 2006 Vintage Lace Up Goth Floral Black Size 6 Jacket","1","$51.00","08/15/2026","875835830928","0","5.99","0"
"View Order","64784282","273761139","Genuine Leather Men's Black Leather Vest Size L","1","$20.00","08/19/2026","9249090272034202891766","0","14.7","7.98"
"View Order","64784282","273590448","Fantasy Novel Bundle: Dragonlance, Forgotten Realms, Shadowrun (Set of 6 Books)","1","$10.00","08/19/2026","9249090272034202891766","0","14.7","7.98"
"View Order","64804568","274070133","Star Trek Bajoran Interceptor Ship Model Figure","1","$15.00","08/20/2026","383414280071","0","10.84","10.97"
"View Order","64804568","274106778","Lootcrate Action Figure Terminator Endoskeleton Skull Silver Display Collectible","1","$16.00","08/20/2026","383414280071","0","10.84","10.97"
"View Order","64804568","273886328","Lot of Four Assorted Dungeons and Dragons Hardcover Players Handbooks","1","$64.00","08/20/2026","383414280071","0","10.84","10.97"
"View Order","64805580","273976567","Vintage Niles East Letterman Cardigan Sweater - 68 Patch","1","$29.93","08/20/2026","383393829940","0","0.01","0"
"View Order","64831885","274038206","Vintage Evan-Picone Womens 2-Piece Red Black Houndstooth Wool Suit Sz 12","1","$19.47","08/21/2026","876329972166","0","9.43","12"
"View Order","64831885","274041823","Vintage Gunit Silk Top M Art Deco Beaded Sequins Faux Pearls India","1","$19.47","08/21/2026","876329972166","0","9.43","12"
"View Order","64831885","273936354","Burning Torch Womens Small Dark Gray Sweatshirt Floral Glass Metal Embellish","1","$7.98","08/21/2026","876329972166","0","9.43","12"
"View Order","64850692","274289640","4 Vintage Fisher-Price Toys Hickory Dickory Dock Clock Music Box Record Player","1","$19.99","08/22/2026","876364142932","0","12.08","2"
"View Order","64850702","274214620","Punk Rave Womens Black Sleeveless Halter Top WT-76SBXF Size F M-L Gothic","1","$21.00","08/22/2026","876185156368","0","5.99","0"
"View Order","64892804","274480963","Dehen University Vintage Wool Varsity Letterman Cardigan Sweater Black Red","1","$47.00","08/24/2026","876326080344","0","5.99","0"
"View Order","64892844","274250393","Puma x Fenty by Rihanna Creeper Sneakers 366268 01 US 7.5 Dark Green","1","$8.99","08/24/2026","876274949352","0","10.74","8"
"View Order","64892844","274247606","Brown Suede Western Cowboy Hat with Fringe Tassels and Metal Studs Vintage","1","$7.99","08/24/2026","876274949352","0","10.74","8"
"View Order","64928774","273538737","The Beatles 2XL Black Denim Vest 100% Cotton 2018 Band Patch Heavy Metal","1","$29.95","08/26/2026","876361044462","0","5.99","0"
"View Order","64974963","274828228","Dungeons & Dragons 3rd Edition Adventure Modules & Sourcebooks RPG Collection","1","$46.25","08/27/2026","876478648793","0","9.9","2"
"View Order","64987252","273850167","Dune by Frank Herbert - Hardcover Edition","1","$24.91","08/28/2026","541843799070","0","0.01","0"
"View Order","64997918","275296105","Fantasy Book Lot J.r.r. Tolkien Lord of the Rings Set Jane Yolen Dragonlance","1","$4.99","08/28/2026","9434636106616275070701","0","14.72","3.5"
"View Order","64997940","274732122","New Age Healing Quest for the Unknown Hardcover Book Reader's Digest","1","$9.99","08/28/2026","876957230454","0","19.22","5.97"
"View Order","64997940","274745099","Wicca for One by Raymond Buckland Paperback Solitary Witchcraft Guide","1","$9.99","08/28/2026","876957230454","0","19.22","5.97"
"View Order","64997940","274667067","Evergame Battle Game Mat Foldable Dry Erase RPG Mat with Dice Markers Set","1","$9.99","08/28/2026","876957230454","0","19.22","5.97"
"View Order","65035560","275138868","Cyberpunk EuroTour Danger & Death on a Euro-Rock Tour RPG Sourcebook R Talsorian","1","$28.89","08/30/2026","876525968818","0","11.57","10.47"
"View Order","65035560","275134131","Cyberpunk RPG Corporation Report 2020 & 77 Stories + Force Unleashed Guide","1","$23.01","08/30/2026","876525968818","0","11.57","10.47"
"View Order","65035560","275135394","Daggerheart Core Set RPG Rulebook Cards Tokens Complete Critical Role Darrington","1","$42.00","08/30/2026","876525968818","0","11.57","10.47"
"View Order","65035618","274965587","Vintage Wilsons Leather Pelle Studio | Women's S Burgundy Leather Blazer Button","1","$9.99","08/30/2026","876696929827","0","10.84","4"
"View Order","65035618","275074986","Classics Book Assortment | The Shining, To Kill a Mockingbird, Dune (Lot of 7)","1","$22.77","08/30/2026","876696929827","0","10.84","4"
"View Order","65046523","275647666","Vintage Deckers Varsity Letterman Cardigan Sweater Black Wool Size 38","1","$29.95","08/31/2026","876587727578","0","5.99","0"
"View Order","65048677","274418904","Hell Bunny Womens XS Black Cardigan Gothic Embroidered RIP Tombstone Sweater","1","$29.95","08/31/2026","876567288379","0","5.99","0"
"View Order","65062393","275282414","Frazetta Art Prints Fantasy Western Lot Framed Wall Decor Set 1963 Sword","1","$54.00","09/01/2026","383512629902","0","14.42","2.99"
"View Order","65062396","275286039","Vintage Frazetta Fantasy Art Wood Plaque Set of 3","1","$62.00","09/01/2026","383512383062","0","12.06","2.99"
"View Order","65062473","275287466","Vintage Frank Frazetta Fantasy Sci-fi Art Wood Plaque 3pc Set","1","$42.00","09/01/2026","383512500738","0","12.06","2.99"
"View Order","65062487","275590442","Authentic Dolce & Gabbana Unisex Shiny Black Glasses","1","$19.99","09/01/2026","383526589327","0","12.76","10"
"View Order","65062487","275452900","Abystyle Dune Side Handle Fear Is The Mind Killer Cup Factory Sealed","1","$11.99","09/01/2026","383526589327","0","12.76","10"
"View Order","65062494","275270695","Southern Sporting Goods Size 38 Green Wool Letterman Jacket with Brown Lining","1","$16.00","09/01/2026","876591569744","0","16.48","4"
"View Order","65062494","275241997","Alternative Rock Shirt Lot Nirvana My Chemical Romance XS Small 6pc","1","$37.00","09/01/2026","876591569744","0","16.48","4"
"View Order","65062501","275351046","Vintage 90s Wilda New York Leather Aviator Jacket Faux Fur Lined Hooded Sz M","1","$13.99","09/01/2026","383480609864","0","15.63","7.5"
"View Order","65062501","275245798","Dragon Magazine Dungeons & Dragons Lot 4 Issues 291 292 293 299 2002 D&D RPG","1","$31.00","09/01/2026","383480609864","0","15.63","7.5"
"View Order","65091202","274967309","Vintage 1978 Leonard Rosenman – The Lord Of The Rings Vinyl Records, LOR-1","1","$12.88","09/02/2026","9449050105799011515333","0","5.13","3"
"View Order","65091223","275127101","Sedici ADV Series Motorcycle Riding Suit Jacket 2XL Pants 34 Gray Black","1","$63.12","09/02/2026","876776216656","0","10.74","8"
"View Order","65091223","274970243","Vintage Deken Portland 100% Wool Red Varsity Sweater Size 46 Letterman","1","$14.00","09/02/2026","876776216656","0","10.74","8"
"View Order","65091279","275132874","Spanx Black White Pants Suit Womens Size L","1","$16.98","09/02/2026","383575239528","0","9.77","6"
"View Order","65091279","275116393","Levi Strauss & Co. Black Polyester Womens Jacket Size L","1","$13.34","09/02/2026","383575239528","0","9.77","6"
"View Order","65091318","275154175","Vint Antique Style Decorative Tan Globe","1","$11.99","09/02/2026","876944822934","0","22.26","3.99"
"View Order","65091387","275106317","Lot of 6 Designer Sunglasses Including Maui Jim, Tommy Hilfiger, Ray Ban, More","1","$78.00","09/02/2026","876689930748","0","11.34","3"
"View Order","65112884","275251919","Vintage JRR Tolkien The Hobbit 1966 Hardcover Fantasy/Fiction Book with Slipcase","1","$71.00","09/02/2026","876746960306","0","11.81","3"
"View Order","65122867","275273094","Batman The Animated Series 3-D Board Game Parker Brothers 1992 Vintage Retro DC","1","$9.99","09/03/2026","383554249299","0","16.64","5"
"View Order","65122867","275187622","Sisterhood Of Dune Signed Poster Illustration Art Brian Herbert Kevin","1","$9.99","09/03/2026","383554249299","0","16.64","5"
"View Order","65202714","275674157","Vintage 50s Hilers Men's Black Wool Letterman Varsity Cardigan Sweater Patches","1","$62.00","09/07/2026","383602211625","0","31.73","3"
"View Order","65221462","275784631","The Art of the Movie Heavy Metal Book 1980s Animation Concept Art Softcover","1","$14.99","09/07/2026","383633161100","0","15.22","4"
"View Order","65221462","275671860","Vintage 40s Hawley Products Co WWII US Military Sun Helmet Pith Safari Hat Tan","1","$14.99","09/07/2026","383633161100","0","15.22","4"
"View Order","65221552","275369000","Sandworms of Dune Hardcover 1st Edition 2007 Brian Herbert Sci Fi Book","1","$9.99","09/07/2026","9249090415639200050189","0","5.13","1.99"
"View Order","65221564","274966761","2010 Dungeons And Dragons Board Game Gamma World Roleplaying Game 4th Edition","1","$21.88","09/07/2026","877183010080","0","13.04","3.99"
"View Order","65273430","276283606","The Arkham Asylum Files Panic in Gotham City Batman Mixed Reality Board Game","1","$19.99","09/09/2026","877118272870","0","17.61","2"
"View Order","65273430","276208128","Maeve Women's Ruched Long-Sleeve V-Neck Top Gothic Goth Black Medium Shirt","1","$14.99","09/09/2026","877118272870","0","17.61","2"
"View Order","65273455","275541880","Heavy Metal Magazine July 1991 Olivia De Berardinis Bettie Page Cover Nice VF","1","$14.99","09/09/2026","383672023398","0","9.52","3.5"
"View Order","65297907","275989881","Gothic Fantasy Hardcover Book Set Sprayed Edges Lot of 4","1","$52.00","09/10/2026","877081715925","0","21.12","4.5"
"View Order","65297950","276150731","Gothic Victorias Secret Black White Bat Spiderweb Heart Cross Handbags","1","$41.00","09/10/2026","877247661244","0","15.63","2"
"View Order","65340633","275427407","Factory Sealed Holy Grail Titan Board Game w/ 4 Sealed Expansions","1","$31.00","09/13/2026","383726937381","0","44.36","2"
"View Order","65441309","276973144","Global Identity G-III Women’s Leather Coat Black Long Trench Duster Gothic SZ M","1","$16.00","09/17/2026","877432428286","0","10.64","3"
"View Order","65559517","277351736","Free Pople Women's Black Lace Bodycon Mini Dress - Size S","1","$12.99","09/22/2026","877644262620","0","12.53","6"
"View Order","65559517","277242510","Lot Of 3 Goth/horror Books (Dracula, Ghostgirl)","1","$12.99","09/22/2026","877644262620","0","12.53","6"
"View Order","65604302","277826193","Ted Baker Dress Womens Size 2","1","$10.99","09/24/2026","877858358677","0","12.29","2"
"View Order","65604812","276386399","For Her NYC Womens 2X Faux Leather Moto Jacket White Black Graffiti Studs","1","$29.95","09/24/2026","877751882417","0","5.99","0"
"View Order","65635455","277869388","Promise New York Black Textured Fringe Jacket","1","$6.99","09/25/2026","383929900790","0","12.13","9"
"View Order","65635455","277721382","Wilsons Women's Black Leather Snap Button Cropped Vest Size M","1","$4.99","09/25/2026","383929900790","0","12.13","9"
"View Order","65635455","277805357","Vintage Star Trek Book Lot of 2","1","$6.99","09/25/2026","383929900790","0","12.13","9"
"View Order","65732095","278063162","D&D 3.5 Monster Manual Book of Exalted Deeds Spell Compendium Lot of 3","1","$32.00","09/30/2026","878124162607","0","10.31","9"
"View Order","65732095","278063814","D&D 3.5 Player's Handbook Dungeon Master's Guide Manual of the Planes Lot","1","$51.00","09/30/2026","878124162607","0","10.31","9"
"View Order","65732095","278004690","Star Trek Hallmark Keepsake ""The Menagerie"" Christmas Ornament IOB","1","$9.99","09/30/2026","878124162607","0","10.31","9"
"View Order","65761366","278154553","Artisan 925 Sterling Celestial Star Moon Saturn Sunrise Dome Oval Brooch 9.5g","1","$41.00","10/01/2026","383999508753","0","13.26","7"
"View Order","65761366","278247868","Vintage 1990s Star Trek Assorted Magazines (4ct) and Activity Book","1","$7.99","10/01/2026","383999508753","0","13.26","7"
"View Order","65761366","277839150","Framed Fantasy Art Print Female Warrior Gothic Graveyard With Black Frame","1","$9.99","10/01/2026","383999508753","0","13.26","7"
"View Order","65768416","278530879","Magic the Gathering Arena of the Planeswalkers Board Game - Not Inventoried","1","$8.99","10/01/2026","383990163314","0","11.66","7.98"
"View Order","65768416","278352638","Marvel United Multiverse Board Game Miniatures Cards Tokens Pieces Complete","1","$17.00","10/01/2026","383990163314","0","11.66","7.98"`;

console.log("=== Testing BulkImport.vue CSV parsing ===");

const parseCSVText = (text) => {
    const lines = [];
    let row = [];
    let inQuotes = false;
    let currentField = '';
    
    const cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        const nextChar = cleaned[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(currentField.trim());
            currentField = '';
        } else if (char === '\n' && !inQuotes) {
            row.push(currentField.trim());
            if (row.some(f => f !== '')) {
                lines.push(row);
            }
            row = [];
            currentField = '';
        } else {
            currentField += char;
        }
    }
    if (currentField || row.length > 0) {
        row.push(currentField.trim());
        if (row.some(f => f !== '')) {
            lines.push(row);
        }
    }
    
    if (lines.length < 2) return [];
    
    const headers = lines[0].map(h => h.replace(/^\uFEFF/, '').replace(/^"|"$/g, '').trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i];
        const rowObj = {};
        for (let j = 0; j < headers.length; j++) {
            let val = values[j] !== undefined ? values[j].trim() : '';
            if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
                val = val.slice(1, -1);
            }
            rowObj[headers[j]] = val;
        }
        data.push(rowObj);
    }
    
    return data;
};

const rows = parseCSVText(userCsv);
console.log(`Parsed ${rows.length} rows.`);
console.log("First row:", rows[0]);
console.log("Headers detected:", Object.keys(rows[0]));

// Test findCol
const findCol = (keys, keywords) => {
    for (const kw of keywords) {
        const exact = keys.find(k => k.toLowerCase().replace(/\ufeff/g, '').trim() === kw.toLowerCase());
        if (exact) return exact;
    }
    return keys.find(k => keywords.some(kw => k.toLowerCase().replace(/\ufeff/g, '').includes(kw)));
};

const rKeys = Object.keys(rows[0]);
const itemCol = findCol(rKeys, ['item id', 'item #', 'itemid', 'item_id', 'itemno', 'item number', 'sku']);
const orderCol = findCol(rKeys, ['order id', 'order #', 'order number', 'orderid', 'order no', 'invoice id', 'invoice #', 'order', 'invoice']);
console.log(`itemCol: "${itemCol}", orderCol: "${orderCol}"`);

// Check HaulIngestionWizard.vue logic:
console.log("\n=== Testing HaulIngestionWizard.vue CSV parsing ===");
const lines = userCsv.split(/\r?\n/).filter(l => l.trim().length > 0);
const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
console.log("Header:", header);
const itemIdIdx = header.findIndex(h => h.includes('item id') || h.includes('item #') || h.includes('itemid') || h.includes('item_id') || h.includes('item number') || h.includes('itemno'));
const orderIdIdx = header.findIndex(h => h.includes('order id') || h.includes('order #') || h.includes('orderid') || h.includes('order_id') || h.includes('invoice'));
const titleIdx = header.findIndex(h => h.includes('title') || h.includes('description') || h.includes('item'));
const priceIdx = header.findIndex(h => h.includes('price') || h.includes('paid') || h.includes('bid') || h.includes('cost') || h.includes('amount'));

console.log(`HaulIngestionWizard indices -> itemIdIdx: ${itemIdIdx} ("${header[itemIdIdx]}"), orderIdIdx: ${orderIdIdx} ("${header[orderIdIdx]}"), titleIdx: ${titleIdx} ("${header[titleIdx]}"), priceIdx: ${priceIdx} ("${header[priceIdx]}")`);

for (let i = 1; i <= 5; i++) {
    const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
    console.log(`Line ${i} matched tokens length: ${row.length} (expected: ${header.length})`);
    console.log(`Tokens:`, row);
}
