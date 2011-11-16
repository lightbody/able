package net.lightbody.able.hibernate;

import org.hibernate.mapping.PersistentClass;
import org.hibernate.tuple.Instantiator;
import org.hibernate.tuple.entity.EntityMetamodel;
import org.hibernate.tuple.entity.PojoEntityTuplizer;

public class GuiceEntityTuplizer extends PojoEntityTuplizer {
    public GuiceEntityTuplizer(EntityMetamodel entityMetamodel, PersistentClass mappedEntity) {
        super(entityMetamodel, mappedEntity);
    }

    protected Instantiator buildInstantiator(PersistentClass persistentClass) {
        return new GuiceInstantiator(persistentClass.getEntityName());
    }
}
