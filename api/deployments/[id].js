import supabase from '../../lib/supabase.js';
import { corsHeaders, handleError } from '../../lib/cors.js';

export default async function handler(req, res) {
  // Handle CORS
  if (corsHeaders(req, res)) return;

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('deployments')
        .select(`
          *,
          templates(name, industry, description),
          deployment_logs(*)
        `)
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            error: { code: '404', message: 'Deployment not found' }
          });
        }
        throw error;
      }
      
      res.status(200).json(data);
      
    } else if (req.method === 'PUT') {
      const { status, deploymentProgress, errorDetails } = req.body;
      
      const updateData = {
        updatedAt: new Date().toISOString()
      };
      
      if (status) updateData.status = status;
      if (deploymentProgress) updateData.deploymentProgress = deploymentProgress;
      if (errorDetails) updateData.errorDetails = errorDetails;
      
      // Set timestamps based on status
      if (status === 'in_progress' && !updateData.startedAt) {
        updateData.startedAt = new Date().toISOString();
      } else if (status === 'completed' || status === 'failed') {
        updateData.completedAt = new Date().toISOString();
        
        // Calculate execution time
        const { data: currentDeployment } = await supabase
          .from('deployments')
          .select('startedAt')
          .eq('id', id)
          .single();
          
        if (currentDeployment?.startedAt) {
          const startTime = new Date(currentDeployment.startedAt);
          const endTime = new Date();
          updateData.executionTime = Math.round((endTime - startTime) / 1000);
        }
      }
      
      const { data, error } = await supabase
        .from('deployments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(200).json(data);
      
    } else {
      res.status(405).json({
        error: { code: '405', message: 'Method not allowed' }
      });
    }
    
  } catch (error) {
    handleError(res, error, 'Failed to process deployment request');
  }
}