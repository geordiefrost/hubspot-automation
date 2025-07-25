import supabase from '../../lib/supabase.js';
import { corsHeaders, handleError } from '../../lib/cors.js';

export default async function handler(req, res) {
  // Handle CORS
  if (corsHeaders(req, res)) return;

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            error: { code: '404', message: 'Template not found' }
          });
        }
        throw error;
      }
      
      res.status(200).json(data);
      
    } else if (req.method === 'PUT') {
      const { name, description, industry, config } = req.body;
      
      const { data, error } = await supabase
        .from('templates')
        .update({
          name,
          description,
          industry,
          config,
          updatedAt: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(200).json(data);
      
    } else if (req.method === 'DELETE') {
      // Soft delete by setting isActive to false
      const { data, error } = await supabase
        .from('templates')
        .update({ 
          isActive: false,
          updatedAt: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(200).json({ message: 'Template deleted successfully' });
      
    } else {
      res.status(405).json({
        error: { code: '405', message: 'Method not allowed' }
      });
    }
    
  } catch (error) {
    handleError(res, error, 'Failed to process template request');
  }
}