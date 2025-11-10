(function(global) {
    const defaultMenuData = {
        'sandwiches': [
            { id: 's1', name: 'CapreseKiss', description: 'Pesto, Tomatoes, Mozzarella, Arugula', image: 'CapreseKiss.png', sizes: [{ size: 'XL', price: 8, weight: '600gr' }] },
            { id: 's2', name: 'TunaTurner', description: 'SXL Sauce, Tuna, Corn, Capers, Red Onion, Pickles, Green Olives, Lettuce, Lemon', image: 'TunaTurner.png', isPopular: true, sizes: [{ size: 'XL', price: 10, weight: '510gr' }] },
            { id: 's3', name: 'PilePile', description: 'Chicken Breast, Yogurt Sauce, Pickles, Walnuts, Dried Dill', image: 'PilePile.png', sizes: [{ size: 'XL', price: 7, weight: '400gr' }] },
            { id: 's4', name: 'AdriaticBond', description: 'SXL Sauce, Ajvar Sauce, Beef Kullen, Salami, Kobasica, Pickles, Tomato, Mozzarella, Green Olive, Lettuce', image: 'AdriaticBond.png', sizes: [{ size: 'XL', price: 13, weight: '500gr' }, { size: 'XXL', price: 16, weight: '640gr' }] },
            { id: 's5', name: 'MeatMax', description: 'Tandoori Meat, Dry Beef Rump Steak, Prosciutto, Dried Tomatoes, Pickles, Red Onion, Eggplant, Zucchini, Potato', image: 'MeatMax.png', isPopular: true, sizes: [{ size: 'XL', price: 18, weight: '570gr' }, { size: 'XXL', price: 21, weight: '670gr' }] },
            { id: 's6', name: 'HolyCow!', description: 'SXL Sauce, Dry Beef Prosciutto, Rump Steak, Smoked Beef, Gouda, Mozzarella, Dried Tomatoes, Pickles, Walnuts, Arugula', image: 'HolyCow.png', sizes: [{ size: 'XL', price: 15, weight: '550gr' }, { size: 'XXL', price: 18, weight: '640gr' }] },
            { id: 's7', name: 'CrunchZilla', description: 'Fresh Crispy Chicken, SXL Sauce, Gouda, Lettuce, Pesto Sauce', image: 'CrunchZilla.png', isPopular: true, sizes: [{ size: 'XL', price: 14, weight: '510gr' }, { size: 'XXL', price: 17, weight: '600gr' }] },
            { id: 's8', name: 'RoyalSmokeBurrata', description: 'Smoked Salmon, Smoked Beef, Truffle Ajoli, Light Crushed Walnuts, Baby Arugula, Fresh Burrata Cheese', image: 'RoyalSmokeBurrata.png', isPopular: true, sizes: [{ size: 'XL', price: 39, weight: '320gr' }] },
            { id: 's9', name: 'Tandoorium', description: 'Tandoori Meat, Cheddar Cheese, Barbecue Sauce, Cheddar Sauce', image: 'Tandoorium.png', sizes: [{ size: 'XL', price: 15, weight: '400gr' }, { size: 'XXL', price: 18, weight: '500gr' }] },
            { id: 's10', name: 'BalkanMorning', description: 'SXL Sauce, Ajvar Sauce, Egg, Gouda, Mozzarella, Tomato, Cucumber, Green Pepper, Red Pepper, Olive, Lettuce, Walnut', image: 'BalkanMorning.png', sizes: [{ size: 'XL', price: 9, weight: '470gr' }] },
            { id: 's11', name: 'ChocoVita', description: 'Nutella, Pistachio, Pistachio Cream, Banana, Oreo, Honey', image: 'ChocoVita.png', sizes: [{ size: 'XL', price: 8, weight: '400gr' }] },
            { id: 's12', name: 'MortaLisa', description: 'Pesto Sauce, Mortadella, Olives, Pistachios, Mozzarella, Honey, Arugula', image: 'MortaLisa.png', sizes: [{ size: 'XL', price: 10, weight: '470gr' }, { size: 'XXL', price: 12, weight: '540gr' }] },
            { id: 's13', name: 'VeggieLand', description: 'Ajvar Sauce, Zucchini, Eggplant, Potatoes, Carrots, Dried Tomatoes, Green Peppers, Kapia', image: 'VeggieLand.png', sizes: [{ size: 'XL', price: 8, weight: '450gr' }] },
            { id: 's14', name: 'VeggieBoom', description: 'Sxl Vegan Meatball Mix, Ajvar Sauce, Green Pepper, Red Onion, Arugula, Basil Tomato Sauce', image: 'VeggieBoom.png', sizes: [{ size: 'XL', price: 14, weight: '510gr' }, { size: 'XXL', price: 17, weight: '600gr' }] }
        ],
        'pasta': [
            { id: 'p1', name: 'PilePasta', description: 'Fusilli Pasta, Chicken Breast, Pesto Sauce, Parmesan Cheese', image: 'PilePasta.png', isPopular: true, sizes: [{ size: 'XL', price: 9, weight: '400gr' }] },
            { id: 'p2', name: 'BoomPasta', description: 'Fusilli Pasta, Basil Tomato Sauce, Vegan Boom Balls', image: 'BoomPasta.png', sizes: [{ size: 'XL', price: 11, weight: '430gr' }] },
            { id: 'p3', name: 'TunaTwist', description: 'Fusilli Pasta, Tuna, Capers, Corn, Pickles, Green Olives', image: 'TunaTwist.png', sizes: [{ size: 'XL', price: 10, weight: '480gr' }] },
            { id: 'p4', name: 'TandooriTangle', description: 'Fusilli Pasta, Tandoori Meat, Cheddar Sauce, Parmesan Cheese', image: 'TandooriTangle.png', isPopular: true, sizes: [{ size: 'XL', price: 12, weight: '410gr' }] },
            { id: 'p5', name: 'CrunchPasta', description: 'Fusilli Pasta, Crispy Chicken, Cheddar Sauce, Caesar Sauce, Parmesan Cheese', image: 'CrunchPasta.png', sizes: [{ size: 'XL', price: 12, weight: '420gr' }] },
            { id: 'p6', name: 'Veganissimo', description: 'Fusilli Pasta, Tomato Sauce, Tomato, Red Peppers, Green Peppers, Green Olive, Thinly sliced Pickles, Sweet Corn', image: 'Veganissimo.png', sizes: [{ size: 'XL', price: 9, weight: '420gr' }] }
        ],
        'salads': [
            { id: 'sa1', name: 'VegetableSalad', description: 'Tomato, Cucumber, Pickles, Green-Red Pepper, Red Onion, Corn, Olive, Lemon, Olive Oil, Lettuce, Arugula', image: 'VegetableSalad.png', sizes: [{ size: 'XL', price: 8, weight: '400gr' }] },
            { id: 'sa2', name: 'TunaSalad', description: 'Tuna, Capers, Corn, Pickles, Red Onion, Green Olives, Lettuce, Arugula, Green-Red Peppers', image: 'TunaSalad.png', isPopular: true, sizes: [{ size: 'XL', price: 10, weight: '530gr' }] },
            { id: 'sa3', name: 'CaesarSalad', description: 'Crispy Chicken, Caesar Sauce, Lettuce, Tomatoes, Arugula, Lemon', image: 'CaesarSalad.png', sizes: [{ size: 'XL', price: 10, weight: '470gr' }] }
        ],
        'desserts': [
            { id: 'd1', name: 'Çikolatalı Sufle', description: 'Akışkan çikolatalı, sıcak ve taze sufle.', image: 'CikolatalSufle.png', sizes: [{ size: 'Tek Boy', price: 6, weight: '200gr' }] },
            { id: 'd2', name: 'Cheesecake', description: 'Limonlu veya Çilekli seçenekleriyle.', image: 'Cheesecake.png', isPopular: true, sizes: [{ size: 'Tek Boy', price: 5, weight: '250gr' }] },
            { id: 'd3', name: 'Tiramisu', description: 'Geleneksel İtalyan tatlısı.', image: 'Tiramisu.png', sizes: [{ size: 'Tek Boy', price: 7, weight: '220gr' }] }
        ],
        'drinks': [
            { id: 'dr1', name: 'Kola', description: '330ml Kutu', image: 'Kola.png', isPopular: true, sizes: [{ size: '330ml', price: 2.5, weight: '330ml' }] },
            { id: 'dr2', name: 'Ayran', description: '300ml Kutu', image: 'Ayran.png', sizes: [{ size: '300ml', price: 2, weight: '300ml' }] },
            { id: 'dr3', name: 'Su', description: '500ml Pet', image: 'Su.png', sizes: [{ size: '500ml', price: 1.5, weight: '500ml' }] },
            { id: 'dr4', name: 'Portakal Suyu', description: 'Taze Sıkılmış', image: 'PortakalSuyu.png', isPopular: true, sizes: [{ size: '300ml', price: 4, weight: '300ml' }] },
            { id: 'dr5', name: 'Kahve', description: 'Filtre Kahve', image: 'Kahve.png', sizes: [{ size: 'Orta Boy', price: 3.5, weight: '250ml' }] }
        ]
    };

    Object.defineProperty(global, 'SandwichXLDefaultMenuData', {
        value: defaultMenuData,
        writable: false,
        enumerable: true,
        configurable: false
    });
})(window);
