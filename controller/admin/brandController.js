const Brand = require('../../models/brandSchema');


const brandInfo = async (req, res) => {
  try {

    const allBrands = await Brand.find();
 
    

    res.render('brand',{
      brands:allBrands
    })
  } catch (error) {
    console.error('Error fetching brand data:', error);
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
