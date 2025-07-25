import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// Components
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Templates from './pages/Templates';
import TemplateEditor from './pages/TemplateEditor';
import Deployments from './pages/Deployments';
import DeploymentDetail from './pages/DeploymentDetail';
import Import from './pages/Import';
import QuickTest from './pages/QuickTest';
import Settings from './pages/Settings';

// Context
import { AppProvider } from './context/AppContext';

function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <AppProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/templates/new" element={<TemplateEditor />} />
              <Route path="/templates/:id" element={<TemplateEditor />} />
              <Route path="/deployments" element={<Deployments />} />
              <Route path="/deployments/:id" element={<DeploymentDetail />} />
              <Route path="/import" element={<Import />} />
              <Route path="/quick-test" element={<QuickTest />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </Router>
      </AppProvider>
    </DndProvider>
  );
}

export default App;