import BottomNav from '../components/BottomNav.jsx';
import DraggableList from '../components/DraggableList.jsx';

export default function Ajustes({
  catGastoList, catIngresoList, medioList,
  onCreateCat, onUpdateCat, onDeleteCat, onReorderCats,
  onCreateMedium, onUpdateMedium, onDeleteMedium, onReorderMediums,
  onNav
}) {
  const reorderGasto = arr => onReorderCats(arr, 'gasto');
  const reorderIngreso = arr => onReorderCats(arr, 'ingreso');

  return (
    <div className="screen">
      <div className="screen-header" style={{ background: '#e8f2ec', borderBottom: '1px solid #c8dcc8' }}>
        <div style={{ padding: '14px 20px 14px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>Ajustes</div>
          <div style={{ fontSize: 12, color: '#4a8a58', marginTop: 2 }}>Arrastrá para reordenar</div>
        </div>
      </div>
      <div className="scroll" style={{ paddingTop: 20 }}>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Categorías de gastos</span>
          <button onClick={() => reorderGasto([...catGastoList].sort((a, b) => a.name.localeCompare(b.name, 'es')))} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#888', cursor: 'pointer', fontFamily: 'inherit' }}>A–Z</button>
        </div>
        <DraggableList
          items={catGastoList}
          hasColor
          onReorder={reorderGasto}
          onEdit={(i, val) => onUpdateCat(catGastoList[i].id, val)}
          onDelete={i => onDeleteCat(catGastoList[i].id)}
          onAdd={() => onCreateCat({ name: 'Nueva categoría', color: '#b0aaaa', kind: 'gasto' })}
          addLabel="Agregar categoría de gasto"
        />

        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Categorías de ingresos</span>
          <button onClick={() => reorderIngreso([...catIngresoList].sort((a, b) => a.name.localeCompare(b.name, 'es')))} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#888', cursor: 'pointer', fontFamily: 'inherit' }}>A–Z</button>
        </div>
        <DraggableList
          items={catIngresoList}
          hasColor
          onReorder={reorderIngreso}
          onEdit={(i, val) => onUpdateCat(catIngresoList[i].id, val)}
          onDelete={i => onDeleteCat(catIngresoList[i].id)}
          onAdd={() => onCreateCat({ name: 'Nueva categoría', color: '#6bbf8e', kind: 'ingreso' })}
          addLabel="Agregar categoría de ingreso"
        />

        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Medios de pago</span>
          <button onClick={() => onReorderMediums([...medioList].sort((a, b) => a.name.localeCompare(b.name, 'es')))} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#888', cursor: 'pointer', fontFamily: 'inherit' }}>A–Z</button>
        </div>
        <DraggableList
          items={medioList}
          hasColor={false}
          onReorder={onReorderMediums}
          onEdit={(i, val) => onUpdateMedium(medioList[i].id, { name: val.name })}
          onDelete={i => onDeleteMedium(medioList[i].id)}
          onAdd={() => onCreateMedium({ name: 'Nuevo medio' })}
          addLabel="Agregar medio de pago"
        />

        <div style={{ height: 24 }} />
      </div>
      <BottomNav screen="ajustes" onNav={onNav} />
    </div>
  );
}
