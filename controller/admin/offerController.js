const Product = require('../../models/productSchema');
const Brand = require('../../models/brandSchema');
const Offer = require('../../models/offerSchema');

// Get all offers
const getAllOffers = async (req, res) => {
    
    try {

        const offers = await Offer.find().populate('entity')
        console.log(offers,'offers');
        
        res.render('offer',{offers})
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: error.message });
    }
};

// Add a new offer
const addOffer = async (req, res) => {
    let { offerType, entity, discount, validFrom, validTo } = req.body;

    // Check required fields
    if (!offerType || !entity || !discount || !validFrom || !validTo) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate discount value
    if (discount <= 0) {
        return res.status(400).json({ message: 'Discount must be a positive number' });
    }

    // Validate date range
    const startDate = new Date(validFrom);
    const endDate = new Date(validTo);
    if (startDate >= endDate) {
        return res.status(400).json({ message: 'Valid From date must be earlier than Valid To date' });
    }

    // Capitalize offerType
    offerType = offerType.charAt(0).toUpperCase() + offerType.slice(1);

    // Check for existing offers
    const existingOffer = await Offer.findOne({ offerType, entity, validFrom, validTo });
    if (existingOffer) {
        return res.status(400).json({ message: 'An offer already exists for this entity with the same validity period' });
    }

    const offer = new Offer({
        offerType,
        entity,
        discount,
        validFrom,
        validTo
    });

    try {
        const newOffer = await offer.save();
        console.log(newOffer, 'new offer added successfully');

        if (offerType === 'Product') {
            const updatedProduct = await Product.findOneAndUpdate(
                { _id: entity }, 
                { $push: { offers: newOffer._id } }, 
                { new: true }
            ).populate('offers');

            if (!updatedProduct) {
                return res.status(404).json({ message: 'Product not found' });
            }

            return res.status(201).json({ message: 'Offer added to product', updatedProduct });
        } else if (offerType === 'Brand') {
            const updatedBrand = await Brand.findOneAndUpdate(
                { _id: entity }, 
                { $push: { offers: newOffer._id } }, 
                { new: true }
            ).populate('offers');

            if (!updatedBrand) {
                return res.status(404).json({ message: 'Brand not found' });
            }

            const updatedProducts = await Product.updateMany(
                { brand: entity }, 
                { $push: { offers: newOffer._id } }
            );

            return res.status(201).json({ message: 'Offer added to brand and products', updatedBrand, updatedProducts });
        }
    } catch (error) {
        console.log('Error adding offer:', error);
        res.status(400).json({ message: error.message });
    }
};





const getEntitiesByType = async (req, res) => {
    
    const { type } = req.params;
    let entities;

    try {
        
        if (type === 'product') {
            entities = await Product.find();
        } else if (type === 'brand') {
            entities = await Brand.find();
        } else {
            return res.status(400).json({ message: 'Invalid offer type' });
        }

        res.json(entities);
    } catch (error) {
        console.error('Error fetching entities:', error);
        res.status(500).json({ message: error.message });
    }
};




const editOffer = async (req, res) => {
    let { offerType, entity, discount, validFrom, validTo } = req.body;

    // Check required fields
    if (!offerType || !entity || !discount || !validFrom || !validTo) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate discount value
    if (discount <= 0) {
        return res.status(400).json({ message: 'Discount must be a positive number' });
    }

    // Validate date range
    const startDate = new Date(validFrom);
    const endDate = new Date(validTo);
    if (startDate >= endDate) {
        return res.status(400).json({ message: 'Valid From date must be earlier than Valid To date' });
    }

    // Capitalize offerType
    offerType = offerType.charAt(0).toUpperCase() + offerType.slice(1);

    try {
        const offer = await Offer.findByIdAndUpdate(req.params.id, {
            offerType,
            entity,
            discount,
            validFrom,
            validTo
        }, { new: true });

        if (!offer) {
            return res.status(404).json({ message: 'Offer not found' });
        }

        res.json({ message: 'Offer updated successfully', offer });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};



const blockOffer = async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.id);
        if (!offer) return res.status(404).json({ message: 'Offer not found' });

        offer.isBlocked = !offer.isBlocked;
        await offer.save();
        res.json(offer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const deleteOffer = async (req, res) => {
    const { id } = req.params;

    try {

        const offer = await Offer.findById(id);
        if (!offer) {
            return res.status(404).json({ message: 'Offer not found' });
        }


        await Offer.findByIdAndDelete(id);

        if (offer.offerType === 'Product') {
            await Product.updateMany(
                { offers: id }, 
                { $pull: { offers: id } } 
            );
        } else if (offer.offerType === 'Brand') {
            await Brand.updateMany(
                { offers: id }, 
                { $pull: { offers: id } }
            );
        }

        res.status(200).json({ message: 'Offer deleted successfully' });
    } catch (error) {
        console.error('Error deleting offer:', error);
        res.status(500).json({ message: error.message });
    }
};


module.exports = {
    getAllOffers,
    addOffer,
    getEntitiesByType,
    editOffer,
    blockOffer,
    deleteOffer
};
