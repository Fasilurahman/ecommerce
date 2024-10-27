const Brand = require('../../models/brandSchema');


const brandInfo = async (req, res) => {
  try {
    const { page = 1, limit = 2 } = req.query; // Default page is 1, limit is 10 brands per page
    
    // Parse page and limit as integers
    const currentPage = parseInt(page);
    const brandsPerPage = parseInt(limit);

    // Fetch brands for the current page
    const brands = await Brand.find()
      .skip((currentPage - 1) * brandsPerPage) // Skip previous page brands
      .limit(brandsPerPage); // Limit the number of brands per page

    // Calculate total number of brands for pagination
    const totalBrands = await Brand.countDocuments();
    const totalPages = Math.ceil(totalBrands / brandsPerPage); // Total pages based on brand count

    // Render the view with pagination data
    res.render('brand', {
      brands,
      currentPage,
      totalPages,
      brandsPerPage
    });
  } catch (error) {
    console.error('Error fetching brand data:', error);
    res.status(500).send('Internal Server Error');
  }
};



const addBrand = async (req, res) => {
    try {
      console.log(req.body);
      const {brandName,brandDescription} = req.body;
      const existingbrand = await Brand.findOne({ brandName: brandName });
      if (existingbrand) {
        req.flash('error', 'Brand name already exists');
        return res.redirect('/admin/brand');
      }
      const newBrand = new Brand({
        brandName: brandName,
        description: brandDescription
      })

      await newBrand.save();
      
    } catch (error) {
        console.error(error);      
    }
};

const editBrand = async (req, res) => {

  try {
    console.log(req.body);
    const {id, name, description} = req.body;
    const findBrand = await Brand.findById(id);
    const existingbrand = await Brand.findOne({ brandName: name });
    if (existingbrand && existingbrand._id.toString() !== id) {
      req.flash('error', 'Brand name already exists');
      return res.redirect('/admin/brand');
    }
    findBrand.brandName = name
    findBrand.description = description

    await findBrand.save()

    res.send({success: true})
    
    
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const deleteBrand = async (req, res) => {
 
  try {
   const {id} = req.body;
   const deleteBrand = await Brand.findByIdAndDelete(id);

   res.send({
    success:true
   })
    
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  brandInfo,
  addBrand,
  editBrand,
  deleteBrand,
};
