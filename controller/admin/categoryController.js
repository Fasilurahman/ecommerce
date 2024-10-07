const category = require('../../models/categorySchema');


const categoryInfo = async (req, res) => {
    try {
      const allCategories = await category.find()
      res.render('category',{
        cat:allCategories
      })
      
    } catch (error) {
      console.error('Error fetching category data:', error);
    }
};

const addCategory = async (req, res) => {
  try {
      console.log(req.body);
      
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
      console.log('ffffffffffffffffffffffffffffffffffffff',newCategory)
      
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

      // Use findOneAndUpdate to find the category and update in one step
      const updatedCategory = await Category.findOneAndUpdate(
          {
              _id: id,
              $or: [
                  { _id: id },  // Allow the current category by its id
                  { name: { $ne: name } }  // Ensure no other category has the same name
              ]
          },
          {
              name: name,
              description: description
          },
          {
              new: true,  // Return the updated document
              runValidators: true // Ensure schema validation is applied
          }
      );

      if (!updatedCategory) {
          return res.status(400).json({ error: 'Category name already exists or Category not found' });
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
    console.log('Deleting category with ID:', id);
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
  console.log(id);
  
  try {
      const blockcategory = await category.findById(id);
      console.log(blockcategory,'jjjjjjjjjjjjjjjj');
      
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


