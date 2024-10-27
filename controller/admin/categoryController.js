const category = require('../../models/categorySchema');


const categoryInfo = async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1; // Get current page from query, default is 1
      const limit = 1; // Number of categories per page
      const skip = (page - 1) * limit; // Calculate how many categories to skip

      // Count total categories
      const totalCategories = await category.countDocuments();

      // Fetch paginated categories
      const allCategories = await category.find()
          .skip(skip)
          .limit(limit);

      const totalPages = Math.ceil(totalCategories / limit);

      res.render('category', {
          cat: allCategories,
          currentPage: page,
          totalPages: totalPages
      });

  } catch (error) {
      console.error('Error fetching category data:', error);
      res.status(500).send('Server Error');
  }
};


const addCategory = async (req, res) => {
  try {
      
      const { name, description } = req.body; 
      const existingCategory = await category.findOne({ 
        name: { $regex: new RegExp('^' + name + '$', 'i') } 
      });
      if (existingCategory) {
          return res.status(400).json({ error: 'Category already exists' });
      }
      const newCategory = new category({
        name:name,
        description:description
      });
      
      await newCategory.save();
      res.status(200).json({ success: true });
  } catch (error) {
      console.error('Error adding category:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
};


// Edit an existing category
const editCategory = async (req, res) => {
  try {
      const { id, name, description } = req.body;

      // Check if the category name already exists in the database
      const existingCategory = await Category.findOne({ name: name });
      if (existingCategory && existingCategory._id.toString() !== id) {
          return res.status(400).json({ error: 'Category name already exists' });
      }

      // Use findOneAndUpdate to find the category and update in one step
      const updatedCategory = await Category.findOneAndUpdate(
          { _id: id },
          { name: name, description: description },
          {
              new: true,  // Return the updated document
              runValidators: true // Ensure schema validation is applied
          }
      );

      if (!updatedCategory) {
          return res.status(404).json({ error: 'Category not found' });
      }

      res.json({ success: true });
  } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
};



const showProductDetailPage = async (req, res) => {
    const productId = req.params.id;
    try {
      const product = await Product.findById(productId).populate('category').populate('brand');
      if (!product) {
        return res.status(404).send('Product not found');
      }
      res.render('productDetail', { product });
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).send('Internal Server Error');
    }
  };



const deleteCategory = async (req,res)=>{
  try {
    const { id } = req.params;
    const deleteCategory = await category.findByIdAndDelete(id)

    res.send({
      success:true
     })
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}


const blockCategory = async (req, res) => {
  const { id } = req.params;
  
  try {
      const blockcategory = await category.findById(id);
      
      if (!blockcategory) {
          return res.status(404).json({ error: 'Category not found' });
      }
      blockcategory.isBlocked = true;
      await blockcategory.save();
      res.json({ message: 'Category blocked successfully' });
  } catch (error) {
      console.error('Error blocking category:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
};


const unblockCategory = async (req, res) => {
  const { id } = req.params;
  try {
      const unblockcategory = await category.findById(id);
      if (!unblockcategory) {
          return res.status(404).json({ error: 'Category not found' });
      }
      unblockcategory.isBlocked = false;
      await unblockcategory.save();
      res.json({ message: 'Category unblocked successfully' });
  } catch (error) {
      console.error('Error unblocking category:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
};


module.exports = {
    categoryInfo,
    addCategory,
    editCategory,
    showProductDetailPage,
    deleteCategory,
    blockCategory,
    unblockCategory
};


